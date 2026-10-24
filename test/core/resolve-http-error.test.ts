import { describe, expect, it } from 'vitest';
import { errorDefaults } from '../../src/core/error-defaults.js';
import { errorMappingOf, type ErrorMapping } from '../../src/core/error-mapping.js';
import { resolveHttpError } from '../../src/core/resolve-http-error.js';
import { TaggedError, UnmappedErrorTagError, UntaggedErrorValueError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}

const routeOnly = (map: ErrorMapping['map']): ErrorMapping => ({ map, defaults: {}, bodyFormat: 'plain' });

const problemDefaults = errorDefaults({ NotFound: 404 }, { body: 'problem-details' });

describe('resolveHttpError', () => {
  it('resolves a numeric spec to its status', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: '1', message: 'Deal not found' }), routeOnly({ DealNotFound: 404 }));
    expect(resolved._unsafeUnwrap().status).toBe(404);
  });

  it('builds the default body from status, tag and message', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: '1', message: 'Deal not found' }), routeOnly({ DealNotFound: 404 }));
    expect(resolved._unsafeUnwrap().body).toEqual({ statusCode: 404, code: 'DealNotFound', message: 'Deal not found' });
  });

  it('leaves payload fields out of the default body', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: 'secret', message: 'm' }), routeOnly({ DealNotFound: 404 }));
    expect(resolved._unsafeUnwrap().body).not.toHaveProperty('dealId');
  });

  it('uses the tag as message for a plain tagged object', () => {
    const resolved = resolveHttpError({ _tag: 'RateLimited' }, routeOnly({ RateLimited: 429 }));
    expect(resolved._unsafeUnwrap().body).toEqual({ statusCode: 429, code: 'RateLimited', message: 'RateLimited' });
  });

  it('uses a custom body function as the whole body', () => {
    const map = { DealNotFound: { status: 404, body: (e: DealNotFound) => ({ missing: e.dealId }) } };
    const resolved = resolveHttpError(new DealNotFound({ dealId: '7', message: 'm' }), routeOnly(map));
    expect(resolved._unsafeUnwrap()).toEqual({ status: 404, body: { missing: '7' }, problemDetails: false });
  });

  it('fails with UnmappedErrorTagError for a tag missing from the map', () => {
    const resolved = resolveHttpError({ _tag: 'Unknown' }, routeOnly({ DealNotFound: 404 }));
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UnmappedErrorTagError);
  });

  it('does not resolve tags that only exist on Object.prototype', () => {
    const resolved = resolveHttpError({ _tag: 'toString' }, routeOnly({ DealNotFound: 404 }));
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UnmappedErrorTagError);
  });

  it('fails with UntaggedErrorValueError for a plain Error', () => {
    const resolved = resolveHttpError(new Error('plain'), routeOnly({ DealNotFound: 404 }));
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UntaggedErrorValueError);
  });

  it('fails with UntaggedErrorValueError for a non-object', () => {
    const resolved = resolveHttpError('DealNotFound', routeOnly({ DealNotFound: 404 }));
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UntaggedErrorValueError);
  });

  it('resolves an error through its family key', () => {
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), routeOnly({ NotFound: 404 }));
    expect(resolved._unsafeUnwrap()).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'TaskNotFound', message: 'TaskNotFound' },
      problemDetails: false,
    });
  });

  it('prefers a tag key over its family key', () => {
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), routeOnly({ TaskNotFound: 410, NotFound: 404 }));
    expect(resolved._unsafeUnwrap().status).toBe(410);
  });

  it('ignores a family that is not a string', () => {
    const resolved = resolveHttpError({ _tag: 'Odd', _family: 7 }, routeOnly({ Odd: 418 }));
    expect(resolved._unsafeUnwrap().status).toBe(418);
  });

  it('does not resolve families that only exist on Object.prototype', () => {
    const resolved = resolveHttpError({ _tag: 'Odd', _family: 'toString' }, routeOnly({ DealNotFound: 404 }));
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UnmappedErrorTagError);
  });

  it('falls back to the defaults after the route map', () => {
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), {
      map: {},
      defaults: { NotFound: 404 },
      bodyFormat: 'plain',
    });
    expect(resolved._unsafeUnwrap().status).toBe(404);
  });

  it('prefers a route family key over a default tag key', () => {
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), {
      map: { NotFound: 404 },
      defaults: { TaskNotFound: 410 },
      bodyFormat: 'plain',
    });
    expect(resolved._unsafeUnwrap().status).toBe(404);
  });

  it('prefers a default tag key over a default family key', () => {
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), {
      map: {},
      defaults: { TaskNotFound: 410, NotFound: 404 },
      bodyFormat: 'plain',
    });
    expect(resolved._unsafeUnwrap().status).toBe(410);
  });

  it('builds a problem details body for a route number key under problem details defaults', () => {
    const mapping = errorMappingOf({ DealNotFound: 404 }, problemDefaults);
    const resolved = resolveHttpError(new DealNotFound({ dealId: '1', message: 'Deal not found' }), mapping);
    expect(resolved._unsafeUnwrap()).toEqual({
      status: 404,
      body: { type: 'about:blank', title: 'Not Found', status: 404, detail: 'Deal not found', code: 'DealNotFound' },
      problemDetails: true,
    });
  });

  it('builds a problem details body for a family default', () => {
    const mapping = errorMappingOf({}, problemDefaults);
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), mapping);
    expect(resolved._unsafeUnwrap().body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'TaskNotFound',
      code: 'TaskNotFound',
    });
  });

  it('falls back to the tag for the problem details detail', () => {
    const mapping = errorMappingOf({ RateLimited: 429 }, problemDefaults);
    const resolved = resolveHttpError({ _tag: 'RateLimited' }, mapping);
    expect(resolved._unsafeUnwrap().body).toHaveProperty('detail', 'RateLimited');
  });

  it('adds the instance last when one is passed', () => {
    const mapping = errorMappingOf({}, problemDefaults);
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), mapping, '/tasks/1');
    expect(Object.entries(resolved._unsafeUnwrap().body)).toEqual([
      ['type', 'about:blank'],
      ['title', 'Not Found'],
      ['status', 404],
      ['detail', 'TaskNotFound'],
      ['code', 'TaskNotFound'],
      ['instance', '/tasks/1'],
    ]);
  });

  it('leaves the instance out when none is passed', () => {
    const mapping = errorMappingOf({}, problemDefaults);
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), mapping);
    expect(resolved._unsafeUnwrap().body).not.toHaveProperty('instance');
  });

  it('titles an unregistered 4xx status with the bad request phrase', () => {
    const mapping = errorMappingOf({ Teapot: 418 }, problemDefaults);
    const resolved = resolveHttpError({ _tag: 'Teapot' }, mapping);
    expect(resolved._unsafeUnwrap().body).toHaveProperty('title', 'Bad Request');
  });

  it('titles an unregistered 5xx status with the internal server error phrase', () => {
    const mapping = errorMappingOf({ Overloaded: 599 }, problemDefaults);
    const resolved = resolveHttpError({ _tag: 'Overloaded' }, mapping);
    expect(resolved._unsafeUnwrap().body).toHaveProperty('title', 'Internal Server Error');
  });

  it('leaves payload fields out of the problem details body', () => {
    const mapping = errorMappingOf({ DealNotFound: 404 }, problemDefaults);
    const resolved = resolveHttpError(new DealNotFound({ dealId: 'secret', message: 'm' }), mapping);
    expect(resolved._unsafeUnwrap().body).not.toHaveProperty('dealId');
  });

  it('keeps a custom body function under problem details defaults', () => {
    const map = { DealNotFound: { status: 404, body: (e: DealNotFound) => ({ missing: e.dealId }) } };
    const mapping = errorMappingOf(map, problemDefaults);
    const resolved = resolveHttpError(new DealNotFound({ dealId: '7', message: 'm' }), mapping);
    expect(resolved._unsafeUnwrap()).toEqual({ status: 404, body: { missing: '7' }, problemDetails: false });
  });

  it('keeps the default body and no problem details flag under plain defaults', () => {
    const mapping = errorMappingOf({}, errorDefaults({ NotFound: 404 }));
    const resolved = resolveHttpError(new TaskNotFound({ taskId: '1' }), mapping);
    expect(resolved._unsafeUnwrap()).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'TaskNotFound', message: 'TaskNotFound' },
      problemDetails: false,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { resolveHttpError, statusOf } from '../../src/core/resolve-http-error.js';
import { TaggedError, UnmappedErrorTagError, UntaggedErrorValueError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

describe('resolveHttpError', () => {
  it('resolves a numeric spec to its status', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: '1', message: 'Deal not found' }), { DealNotFound: 404 });
    expect(resolved._unsafeUnwrap().status).toBe(404);
  });

  it('builds the default body from status, tag and message', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: '1', message: 'Deal not found' }), { DealNotFound: 404 });
    expect(resolved._unsafeUnwrap().body).toEqual({ statusCode: 404, code: 'DealNotFound', message: 'Deal not found' });
  });

  it('leaves payload fields out of the default body', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: 'secret', message: 'm' }), { DealNotFound: 404 });
    expect(resolved._unsafeUnwrap().body).not.toHaveProperty('dealId');
  });

  it('uses the tag as message for a plain tagged object', () => {
    const resolved = resolveHttpError({ _tag: 'RateLimited' }, { RateLimited: 429 });
    expect(resolved._unsafeUnwrap().body).toEqual({ statusCode: 429, code: 'RateLimited', message: 'RateLimited' });
  });

  it('uses a custom body function as the whole body', () => {
    const map = { DealNotFound: { status: 404, body: (e: DealNotFound) => ({ missing: e.dealId }) } };
    const resolved = resolveHttpError(new DealNotFound({ dealId: '7', message: 'm' }), map);
    expect(resolved._unsafeUnwrap()).toEqual({ status: 404, body: { missing: '7' } });
  });

  it('fails with UnmappedErrorTagError for a tag missing from the map', () => {
    const resolved = resolveHttpError({ _tag: 'Unknown' }, { DealNotFound: 404 });
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UnmappedErrorTagError);
  });

  it('does not resolve tags that only exist on Object.prototype', () => {
    const resolved = resolveHttpError({ _tag: 'toString' }, { DealNotFound: 404 });
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UnmappedErrorTagError);
  });

  it('fails with UntaggedErrorValueError for a plain Error', () => {
    const resolved = resolveHttpError(new Error('plain'), { DealNotFound: 404 });
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UntaggedErrorValueError);
  });

  it('fails with UntaggedErrorValueError for a non-object', () => {
    const resolved = resolveHttpError('DealNotFound', { DealNotFound: 404 });
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UntaggedErrorValueError);
  });
});

describe('statusOf', () => {
  it('reads the status of a numeric spec', () => {
    expect(statusOf(418)).toBe(418);
  });

  it('reads the status of an object spec', () => {
    expect(statusOf({ status: 409, body: () => ({}) })).toBe(409);
  });
});

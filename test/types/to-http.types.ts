import { expectTypeOf } from 'expect-type';
import type { Result, ResultAsync } from 'neverthrow';
import { errorDefaults, TaggedError, toHttp, type ErrorDefaults, type ErrorMap } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class AccessDenied extends TaggedError('AccessDenied') {}

declare const both: ResultAsync<{ id: string }, DealNotFound | AccessDenied>;
declare const syncBoth: Result<{ id: string }, DealNotFound | AccessDenied>;
declare const promised: Promise<Result<{ id: string }, DealNotFound | AccessDenied>>;
declare const untagged: Result<number, DealNotFound | Error>;
declare const infallible: Result<number, never>;
declare const plainTagged: Result<number, { readonly _tag: 'RateLimited' }>;

expectTypeOf(toHttp(both, { DealNotFound: 404, AccessDenied: 403 })).toEqualTypeOf<Promise<{ id: string }>>();
expectTypeOf(toHttp(syncBoth, { DealNotFound: 404, AccessDenied: 403 })).toEqualTypeOf<Promise<{ id: string }>>();
expectTypeOf(toHttp(promised, { DealNotFound: 404, AccessDenied: 403 })).toEqualTypeOf<Promise<{ id: string }>>();
expectTypeOf(toHttp(infallible, {})).toEqualTypeOf<Promise<number>>();
expectTypeOf(toHttp(plainTagged, { RateLimited: 429 })).toEqualTypeOf<Promise<number>>();

toHttp(both, {
  DealNotFound: { status: 404, body: (error) => ({ id: error.dealId }) },
  AccessDenied: 403,
});

// @ts-expect-error
toHttp(both, { DealNotFound: 404 });

// @ts-expect-error
toHttp(both, { DealNotFound: 404, AccessDenied: 403, Stale: 500 });

// @ts-expect-error
toHttp(untagged, { DealNotFound: 404 });

const staleMap = { DealNotFound: 404, AccessDenied: 403, Stale: 500 } as const;
// @ts-expect-error
toHttp(both, staleMap);

class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}
class ProjectNotFound extends TaggedError('ProjectNotFound', { family: 'NotFound' }) {}

declare const family: ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied>;
declare const clash: Result<number, TaskNotFound | { readonly _tag: 'NotFound' }>;

expectTypeOf(toHttp(family, { NotFound: 404, AccessDenied: 403 })).toEqualTypeOf<Promise<number>>();
toHttp(family, { TaskNotFound: 410, NotFound: 404, AccessDenied: 403 });
toHttp(family, {
  NotFound: { status: 404, body: (error) => ({ code: error._tag }) },
  AccessDenied: 403,
});
toHttp(family, {
  TaskNotFound: { status: 404, body: (error) => ({ id: error.taskId }) },
  ProjectNotFound: 404,
  AccessDenied: 403,
});

// @ts-expect-error
toHttp(family, { AccessDenied: 403 });

// @ts-expect-error
toHttp(family, { TaskNotFound: 404, ProjectNotFound: 404, NotFound: 404, AccessDenied: 403 });

// @ts-expect-error
toHttp(clash, { NotFound: 404 });

// @ts-expect-error
toHttp(family, { NotFound: { status: 404, body: (error: TaskNotFound) => ({ id: error.taskId }) }, AccessDenied: 403 });

declare const wideStatus: number;

// @ts-expect-error
toHttp(both, { DealNotFound: 200, AccessDenied: 403 });

// @ts-expect-error
toHttp(both, { DealNotFound: wideStatus, AccessDenied: 403 });

// @ts-expect-error
toHttp(both, { DealNotFound: { status: 302, body: () => ({}) }, AccessDenied: 403 });

// @ts-expect-error
toHttp(both, { DealNotFound: 'oops', AccessDenied: 403 });

const domainDefaults = errorDefaults({ NotFound: 404, Conflict: 409 });

expectTypeOf(toHttp(family, { AccessDenied: 403 }, domainDefaults)).toEqualTypeOf<Promise<number>>();
toHttp(family, { NotFound: 410, AccessDenied: 403 }, domainDefaults);

toHttp(
  family,
  {
    AccessDenied: {
      status: 403,
      body: (error) => {
        expectTypeOf(error).toEqualTypeOf<AccessDenied>();
        return {};
      },
    },
  },
  domainDefaults,
);

// @ts-expect-error
toHttp(family, {}, domainDefaults);

// @ts-expect-error
errorDefaults({ NotFound: 302 });

const problemDefaults = errorDefaults({ NotFound: 404, Conflict: 409 }, { body: 'problem-details' });

expectTypeOf(problemDefaults).toMatchTypeOf(domainDefaults);
expectTypeOf(domainDefaults).toMatchTypeOf(problemDefaults);
expectTypeOf(problemDefaults).toMatchTypeOf<ErrorDefaults<{ readonly NotFound: 404; readonly Conflict: 409 }>>();
expectTypeOf(problemDefaults).toEqualTypeOf<
  ErrorDefaults<{ readonly NotFound: 404; readonly Conflict: 409 }, 'problem-details'>
>();
expectTypeOf(domainDefaults).toEqualTypeOf<ErrorDefaults<{ readonly NotFound: 404; readonly Conflict: 409 }>>();
expectTypeOf(
  toHttp<number, TaskNotFound | ProjectNotFound | AccessDenied, { AccessDenied: 403 }, { readonly NotFound: 404; readonly Conflict: 409 }>(
    family,
    { AccessDenied: 403 },
    problemDefaults,
  ),
).toEqualTypeOf<Promise<number>>();
expectTypeOf(toHttp(family, { AccessDenied: 403 }, problemDefaults)).toEqualTypeOf<Promise<number>>();

// @ts-expect-error
errorDefaults({ NotFound: 404 }, { body: 'xml' });

const completeSatisfiedMap = { NotFound: 404, AccessDenied: 403 } as const satisfies ErrorMap<
  TaskNotFound | ProjectNotFound | AccessDenied
>;
toHttp(family, completeSatisfiedMap);

const incompleteSatisfiedMap = { NotFound: 404 } as const satisfies ErrorMap<TaskNotFound | ProjectNotFound | AccessDenied>;

// @ts-expect-error
toHttp(family, incompleteSatisfiedMap);

const problemTypeDefaults = errorDefaults(
  { NotFound: { status: 404, type: 'https://example.com/problems/not-found' }, Conflict: 409 },
  { body: 'problem-details' },
);

expectTypeOf(
  toHttp(
    family,
    { AccessDenied: { status: 403, type: 'https://example.com/problems/access-denied', title: 'Access denied' } },
    problemDefaults,
  ),
).toEqualTypeOf<Promise<number>>();
expectTypeOf(toHttp(family, { AccessDenied: 403 }, problemTypeDefaults)).toEqualTypeOf<Promise<number>>();

toHttp(
  family,
  {
    AccessDenied: {
      status: 403,
      body: (error) => {
        expectTypeOf(error).toEqualTypeOf<AccessDenied>();
        return {};
      },
    },
    TaskNotFound: { status: 404, type: 'https://example.com/problems/task-not-found' },
  },
  problemDefaults,
);

// @ts-expect-error
toHttp(both, { DealNotFound: { status: 404, type: 'https://example.com/problems/deal-not-found' }, AccessDenied: 403 });

// @ts-expect-error
toHttp(family, { AccessDenied: { status: 403, type: 'https://example.com/problems/access-denied' } }, domainDefaults);

declare const unknownFormatDefaults: ErrorDefaults<{ readonly NotFound: 404 }>;

// @ts-expect-error
toHttp(family, { AccessDenied: { status: 403, type: 'https://example.com/problems/access-denied' } }, unknownFormatDefaults);

// @ts-expect-error
toHttp(family, { AccessDenied: { status: 403, title: 'Access denied' } }, problemDefaults);

// @ts-expect-error
toHttp(family, { AccessDenied: { status: 302, type: 'https://example.com/problems/access-denied' } }, problemDefaults);

toHttp(
  family,
  {
    // @ts-expect-error
    AccessDenied: { status: 403, type: 'https://example.com/problems/access-denied', body: () => ({}) },
  },
  problemDefaults,
);

toHttp(both, {
  // @ts-expect-error
  DealNotFound: { status: 404, type: 'https://example.com/problems/deal-not-found', body: () => ({}) },
  AccessDenied: 403,
});

// @ts-expect-error
errorDefaults({ NotFound: { status: 404, type: 'https://example.com/problems/not-found' } });

const declaredOptions: { readonly body?: 'problem-details' } = { body: 'problem-details' };

// @ts-expect-error
errorDefaults({ NotFound: { status: 404, type: 'https://example.com/problems/not-found' } }, declaredOptions);

// @ts-expect-error
errorDefaults({ NotFound: { status: 302, type: 'https://example.com/problems/not-found' } }, { body: 'problem-details' });

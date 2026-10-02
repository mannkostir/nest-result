import { expectTypeOf } from 'expect-type';
import type { Result, ResultAsync } from 'neverthrow';
import { TaggedError, toHttp } from '../../src/index.js';

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

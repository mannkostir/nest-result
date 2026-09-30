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

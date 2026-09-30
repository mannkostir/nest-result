import type { Result, ResultAsync } from 'neverthrow';
import { MapErrors, TaggedError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class AccessDenied extends TaggedError('AccessDenied') {}

declare const both: ResultAsync<{ id: string }, DealNotFound | AccessDenied>;
declare const promised: Promise<Result<{ id: string }, DealNotFound | AccessDenied>>;
declare const untagged: Result<number, DealNotFound | Error>;

export class TypedController {
  @MapErrors({ DealNotFound: 404, AccessDenied: 403 })
  asyncResult(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  @MapErrors({ DealNotFound: 404, AccessDenied: 403 })
  async promisedResult(): Promise<Result<{ id: string }, DealNotFound | AccessDenied>> {
    return promised;
  }

  @MapErrors({ DealNotFound: { status: 404, body: (error: DealNotFound) => ({ id: error.dealId }) }, AccessDenied: 403 })
  annotatedBody(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404 })
  missingKey(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404, AccessDenied: 403, Stale: 500 })
  staleKey(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404 })
  untaggedError(): Result<number, DealNotFound | Error> {
    return untagged;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404 })
  notAResult(): number {
    return 1;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: { status: 404, body: (error: AccessDenied) => ({ tag: error._tag }) }, AccessDenied: 403 })
  mismatchedBody(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }
}

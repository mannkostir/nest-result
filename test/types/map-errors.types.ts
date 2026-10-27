import type { Result, ResultAsync } from 'neverthrow';
import { errorDefaults, MapErrors, TaggedError, type ErrorStatus } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class AccessDenied extends TaggedError('AccessDenied') {}

declare const both: ResultAsync<{ id: string }, DealNotFound | AccessDenied>;
declare const promised: Promise<Result<{ id: string }, DealNotFound | AccessDenied>>;
declare const untagged: Result<number, DealNotFound | Error>;
class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}
class ProjectNotFound extends TaggedError('ProjectNotFound', { family: 'NotFound' }) {}
declare const family: ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied>;

const MapDomainErrors = MapErrors.withDefaults(errorDefaults({ NotFound: 404, Conflict: 409 }));
const MapProblemErrors = MapErrors.withDefaults(
  errorDefaults(
    { NotFound: { status: 404, type: 'https://example.com/problems/not-found', title: 'Not found' }, Conflict: 409 },
    { body: 'problem-details' },
  ),
);

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

  @MapErrors({ DealNotFound: 404, AccessDenied: 403 })
  private privateRoute(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404 })
  private privateMissingKey(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
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

  @MapErrors({ NotFound: 404, AccessDenied: 403 })
  byFamily(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  @MapErrors({ TaskNotFound: 410, NotFound: 404, AccessDenied: 403 })
  tagOverridesFamily(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  @MapErrors({ NotFound: { status: 404, body: (error: TaskNotFound | ProjectNotFound) => ({ code: error._tag }) }, AccessDenied: 403 })
  familyBody(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  // @ts-expect-error
  @MapErrors({ AccessDenied: 403 })
  missingFamily(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  // @ts-expect-error
  @MapErrors({ TaskNotFound: 404, ProjectNotFound: 404, NotFound: 404, AccessDenied: 403 })
  shadowedFamily(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  // @ts-expect-error
  @MapErrors({ NotFound: { status: 404, body: (error: TaskNotFound) => ({ id: error.taskId }) }, AccessDenied: 403 })
  narrowFamilyBody(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 302, AccessDenied: 403 })
  redirectStatus(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 600, AccessDenied: 403 })
  tooHighStatus(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  @MapDomainErrors({ AccessDenied: 403 })
  withDefaults(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  @MapDomainErrors({ TaskNotFound: 422, AccessDenied: 403 })
  withDefaultsOverride(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  // @ts-expect-error
  @MapDomainErrors({})
  withDefaultsMissing(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  // @ts-expect-error
  @MapDomainErrors({ AccessDenied: 403, Stale: 500 })
  withDefaultsStale(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  @MapProblemErrors({ AccessDenied: { status: 403, type: 'https://example.com/problems/access-denied' } })
  problemType(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  @MapErrors({ DealNotFound: { status: 404, type: 'https://example.com/problems/deal-not-found', body: () => ({}) }, AccessDenied: 403 })
  customBodyWithProblemType(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: { status: 404, type: 'https://example.com/problems/deal-not-found' }, AccessDenied: 403 })
  plainProblemType(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapDomainErrors({ AccessDenied: { status: 403, type: 'https://example.com/problems/access-denied' } })
  plainDefaultsProblemType(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  // @ts-expect-error
  @MapProblemErrors({ AccessDenied: { status: 403, title: 'Access denied' } })
  titleWithoutType(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }

  // @ts-expect-error
  @MapProblemErrors({ AccessDenied: { status: 403, type: 'https://example.com/problems/access-denied' }, Stale: 500 })
  problemTypeStale(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return family;
  }
}

export function mapErrorsOf<M extends Record<string, ErrorStatus>>(map: M) {
  return MapErrors(map);
}

export function mapDomainErrorsOf<M extends Record<string, ErrorStatus>>(map: M) {
  return MapDomainErrors(map);
}

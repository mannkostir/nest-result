import type { ResultAsync } from 'neverthrow';
import { errorDefaults, TaggedError } from '../../src/index.js';
import { MapErrors } from '../../src/swagger/index.js';

class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}
class AccessDenied extends TaggedError('AccessDenied') {}

declare const found: ResultAsync<number, TaskNotFound | AccessDenied>;

const DocumentedDomainErrors = MapErrors.withDefaults(errorDefaults({ NotFound: 404, Conflict: 409 }));

export class DocumentedController {
  @MapErrors({ NotFound: 404, AccessDenied: 403 })
  plain(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  @DocumentedDomainErrors({ AccessDenied: 403 }, { uses: ['NotFound'] })
  withUses(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  @DocumentedDomainErrors({ NotFound: 410, AccessDenied: 403 }, { uses: [] })
  overridden(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @DocumentedDomainErrors({ AccessDenied: 403 }, { uses: [] })
  missingUses(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @DocumentedDomainErrors({ AccessDenied: 403 }, { uses: ['NotFound', 'Conflict'] })
  staleUses(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @DocumentedDomainErrors({}, { uses: ['NotFound'] })
  missingRouteKey(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }
}

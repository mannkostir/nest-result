import { expectTypeOf } from 'expect-type';
import type { ResultAsync } from 'neverthrow';
import { errorDefaults, TaggedError } from '../../src/index.js';
import { MapErrors } from '../../src/swagger/index.js';

class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}
class AccessDenied extends TaggedError('AccessDenied') {}

class ErrorBody {
  readonly code!: string;
}

declare const found: ResultAsync<number, TaskNotFound | AccessDenied>;

const DocumentedDomainErrors = MapErrors.withDefaults(errorDefaults({ NotFound: 404, Conflict: 409 }));

export class DocumentedController {
  @MapErrors({ NotFound: 404, AccessDenied: 403 }, { families: ['NotFound'] })
  plain(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  @DocumentedDomainErrors({ AccessDenied: 403 }, { uses: ['NotFound'], families: ['NotFound'] })
  withUses(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  @DocumentedDomainErrors({ NotFound: 410, AccessDenied: 403 }, { uses: [], families: ['NotFound'] })
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
  @DocumentedDomainErrors({}, { uses: ['NotFound'], families: ['NotFound'] })
  missingRouteKey(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  @MapErrors({ TaskNotFound: 404, AccessDenied: 403 })
  tagOnly(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  @DocumentedDomainErrors({ TaskNotFound: 404, AccessDenied: 403 }, { uses: [] })
  tagOnlyWithDefaults(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @MapErrors({ NotFound: 404, AccessDenied: 403 })
  missingRouteFamily(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @DocumentedDomainErrors({ AccessDenied: 403 }, { uses: ['NotFound'] })
  missingDefaultFamily(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @MapErrors({ TaskNotFound: 404, AccessDenied: 403 }, { families: ['NotFound'] })
  staleFamily(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @DocumentedDomainErrors({ AccessDenied: 403 }, { uses: ['NotFound'], families: ['NotFound', 'Conflict'] })
  staleDefaultFamily(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  @MapErrors(
    { NotFound: 404, AccessDenied: { status: 403, body: (error: AccessDenied) => ({ code: error._tag }) } },
    { families: ['NotFound'], schemas: { NotFound: { type: 'object' }, AccessDenied: ErrorBody } },
  )
  routeSchemas(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  @DocumentedDomainErrors(
    { AccessDenied: 403 },
    {
      uses: ['NotFound'],
      families: ['NotFound'],
      schemas: { NotFound: ErrorBody, AccessDenied: { type: 'object', properties: { code: { type: 'string' } } } },
    },
  )
  usedDefaultSchemas(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @MapErrors({ TaskNotFound: 404, AccessDenied: 403 }, { schemas: { Conflict: ErrorBody } })
  unknownRouteSchema(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }

  // @ts-expect-error
  @DocumentedDomainErrors({ AccessDenied: 403 }, { uses: ['NotFound'], families: ['NotFound'], schemas: { Conflict: ErrorBody } })
  unusedDefaultSchema(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }
}

expectTypeOf(
  // @ts-expect-error
  MapErrors({ AccessDenied: 403 }, { schemas: { TaskNotFound: ErrorBody } }),
).toEqualTypeOf(MapErrors({ AccessDenied: 403 }));

expectTypeOf(
  // @ts-expect-error
  DocumentedDomainErrors({ AccessDenied: 403 }, { uses: [], schemas: { NotFound: ErrorBody } }),
).toEqualTypeOf(DocumentedDomainErrors({ AccessDenied: 403 }, { uses: [] }));

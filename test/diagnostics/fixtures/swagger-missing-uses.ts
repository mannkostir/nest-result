import type { ResultAsync } from 'neverthrow';
import { errorDefaults } from '../../../src/index.js';
import { MapErrors } from '../../../src/swagger/index.js';
import type { AccessDenied, TaskNotFound } from './errors.js';

declare const found: ResultAsync<number, TaskNotFound | AccessDenied>;

const DocumentedDomainErrors = MapErrors.withDefaults(errorDefaults({ NotFound: 404, Conflict: 409 }));

export class TasksController {
  @DocumentedDomainErrors({ AccessDenied: 403 }, { uses: [] })
  find(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }
}

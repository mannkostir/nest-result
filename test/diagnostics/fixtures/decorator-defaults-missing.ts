import type { ResultAsync } from 'neverthrow';
import { errorDefaults, MapErrors } from '../../../src/index.js';
import type { AccessDenied, TaskNotFound } from './errors.js';

declare const found: ResultAsync<number, TaskNotFound | AccessDenied>;

const MapDomainErrors = MapErrors.withDefaults(errorDefaults({ NotFound: 404 }));

export class TasksController {
  @MapDomainErrors({})
  find(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }
}

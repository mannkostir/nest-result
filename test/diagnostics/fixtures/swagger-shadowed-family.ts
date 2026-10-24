import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/swagger/index.js';
import type { AccessDenied, TaskNotFound } from './errors.js';

declare const found: ResultAsync<number, TaskNotFound | AccessDenied>;

export class TasksController {
  @MapErrors({ TaskNotFound: 404, NotFound: 404, AccessDenied: 403 })
  find(): ResultAsync<number, TaskNotFound | AccessDenied> {
    return found;
  }
}

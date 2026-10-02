import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { AccessDenied, ProjectNotFound, TaskNotFound } from './errors.js';

declare const found: ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied>;

export class TasksController {
  @MapErrors({ AccessDenied: 403 })
  find(): ResultAsync<number, TaskNotFound | ProjectNotFound | AccessDenied> {
    return found;
  }
}

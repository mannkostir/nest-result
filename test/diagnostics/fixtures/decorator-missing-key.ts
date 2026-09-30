import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { AccessDenied, DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound | AccessDenied>;

export class DealsController {
  @MapErrors({ DealNotFound: 404 })
  find(): ResultAsync<number, DealNotFound | AccessDenied> {
    return found;
  }
}

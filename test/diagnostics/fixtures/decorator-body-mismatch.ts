import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { AccessDenied, DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound | AccessDenied>;

export class DealsController {
  @MapErrors({ DealNotFound: { status: 404, body: (error: AccessDenied) => ({ tag: error._tag }) }, AccessDenied: 403 })
  find(): ResultAsync<number, DealNotFound | AccessDenied> {
    return found;
  }
}

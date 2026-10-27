import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { AccessDenied, DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound | AccessDenied>;

export class DealsController {
  @MapErrors({ DealNotFound: { status: 404, type: 'https://example.com/problems/deal-not-found' }, AccessDenied: 403 })
  find(): ResultAsync<number, DealNotFound | AccessDenied> {
    return found;
  }
}

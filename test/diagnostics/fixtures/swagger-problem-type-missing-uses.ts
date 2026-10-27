import type { ResultAsync } from 'neverthrow';
import { errorDefaults } from '../../../src/index.js';
import { MapErrors } from '../../../src/swagger/index.js';
import type { AccessDenied, DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound | AccessDenied>;

const DomainErrors = MapErrors.withDefaults(errorDefaults({ AccessDenied: 403 }));

export class DealsController {
  @DomainErrors({ DealNotFound: { status: 404, type: 'https://example.com/problems/deal-not-found' } }, { uses: [] })
  find(): ResultAsync<number, DealNotFound | AccessDenied> {
    return found;
  }
}

import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound>;

export class DealsController {
  @MapErrors({ DealNotFound: 404, Stale: 500 })
  find(): ResultAsync<number, DealNotFound> {
    return found;
  }
}

import type { Result } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: Result<number, DealNotFound | Error>;

export class DealsController {
  @MapErrors({ DealNotFound: 404 })
  find(): Result<number, DealNotFound | Error> {
    return found;
  }
}

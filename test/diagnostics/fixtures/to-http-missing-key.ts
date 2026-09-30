import type { ResultAsync } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { AccessDenied, DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound | AccessDenied>;

export const response = toHttp(found, { DealNotFound: 404 });

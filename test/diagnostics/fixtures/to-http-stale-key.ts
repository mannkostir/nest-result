import type { ResultAsync } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound>;

export const response = toHttp(found, { DealNotFound: 404, Stale: 500 });

import type { Result } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: Result<number, DealNotFound | Error>;

export const response = toHttp(found, { DealNotFound: 404 });

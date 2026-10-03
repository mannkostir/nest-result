import type { Result } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: Result<number, DealNotFound>;
declare const status: number;

export const response = toHttp(found, { DealNotFound: status });

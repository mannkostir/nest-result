import type { Result } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { TaskNotFound } from './errors.js';

declare const found: Result<number, TaskNotFound | { readonly _tag: 'NotFound' }>;

export const response = toHttp(found, { NotFound: 404 });

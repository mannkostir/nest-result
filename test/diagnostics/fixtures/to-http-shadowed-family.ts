import type { Result } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { TaskNotFound } from './errors.js';

declare const found: Result<number, TaskNotFound>;

export const response = toHttp(found, { TaskNotFound: 404, NotFound: 404 });

import { matchError } from '../../../src/index.js';
import type { AccessDenied, TaskNotFound } from './errors.js';

declare const error: TaskNotFound | AccessDenied;

export const handled = matchError(error, { NotFound: () => 'missing', AccessDenied: () => 'denied', Stale: () => 'stale' });

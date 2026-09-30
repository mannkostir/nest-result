import { TaggedError } from '../../../src/index.js';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}

export class AccessDenied extends TaggedError('AccessDenied') {}

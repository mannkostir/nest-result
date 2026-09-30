import { TaggedError } from '../../src/index.js';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

export class AccessDenied extends TaggedError('AccessDenied') {}

export class Unavailable extends TaggedError('Unavailable') {}

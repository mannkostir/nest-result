import { TaggedError } from 'nest-result';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

export class DealAlreadyClosed extends TaggedError('DealAlreadyClosed')<{ dealId: string; message: string }> {}

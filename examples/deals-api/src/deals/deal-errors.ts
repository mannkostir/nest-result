import { TaggedError } from 'nest-result';

export class DealNotFound extends TaggedError('DealNotFound', { family: 'NotFound' })<{ dealId: string; message: string }> {}

export class DealAlreadyClosed extends TaggedError('DealAlreadyClosed', { family: 'Conflict' })<{
  dealId: string;
  message: string;
}> {}

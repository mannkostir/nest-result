import { expectTypeOf } from 'expect-type';
import { matchError, TaggedError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound', { family: 'NotFound' })<{ dealId: string }> {}
class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}
class DealArchived extends TaggedError('DealArchived') {}

declare const error: DealNotFound | TaskNotFound | DealArchived;
declare const untagged: DealNotFound | Error;
declare const clash: DealNotFound | { readonly _tag: 'NotFound' };

expectTypeOf(matchError(error, { NotFound: (e) => e._tag, DealArchived: () => 1 })).toEqualTypeOf<
  'DealNotFound' | 'TaskNotFound' | number
>();
expectTypeOf(
  matchError(error, { DealNotFound: (e) => e.dealId, TaskNotFound: (e) => e.taskId, DealArchived: () => 0 }),
).toEqualTypeOf<string | number>();
expectTypeOf(matchError(error, { NotFound: async () => 'x', DealArchived: async () => 'y' })).toEqualTypeOf<
  Promise<string>
>();
expectTypeOf(
  matchError(error, { DealNotFound: () => 'deal', NotFound: () => 'other', DealArchived: () => 'old' }),
).toEqualTypeOf<string>();

declare const single: DealArchived;

expectTypeOf(matchError(single, { DealArchived: (e) => e })).toEqualTypeOf<DealArchived>();
expectTypeOf(matchError(error, { NotFound: (e) => e._tag, DealArchived: (e) => e._tag })).toEqualTypeOf<
  'DealNotFound' | 'TaskNotFound' | 'DealArchived'
>();
expectTypeOf(matchError(error, { NotFound: (e) => e.message, DealArchived: () => 1 })).toEqualTypeOf<string | number>();

// @ts-expect-error
matchError(error, { NotFound: (e) => e._tag });

// @ts-expect-error
matchError(error, { NotFound: () => 1 });

// @ts-expect-error
matchError(error, { NotFound: () => 1, DealArchived: () => 2, Stale: () => 3 });

// @ts-expect-error
matchError(error, { DealNotFound: () => 1, TaskNotFound: () => 1, NotFound: () => 1, DealArchived: () => 2 });

// @ts-expect-error
matchError(untagged, { DealNotFound: () => 1 });

// @ts-expect-error
matchError(clash, { NotFound: () => 1 });

// @ts-expect-error
matchError(error, { NotFound: (e: DealNotFound) => e.dealId, DealArchived: () => 'old' });

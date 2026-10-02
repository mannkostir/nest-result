import { expectTypeOf } from 'expect-type';
import { TaggedError, type FamilyOf } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}
class Unauthorized extends TaggedError('Unauthorized') {}
class Wrapped extends TaggedError('Wrapped')<{ cause: unknown }> {}
interface OrderPayload {
  readonly orderId: string;
}
class OrderMissing extends TaggedError('OrderMissing')<OrderPayload> {}

expectTypeOf(new DealNotFound({ dealId: '1' })._tag).toEqualTypeOf<'DealNotFound'>();
expectTypeOf(new DealNotFound({ dealId: '1' }).dealId).toEqualTypeOf<string>();
expectTypeOf(new OrderMissing({ orderId: '1' }).orderId).toEqualTypeOf<string>();
expectTypeOf(new Unauthorized()).toMatchTypeOf<Error>();
expectTypeOf(new TaskNotFound({ taskId: '1' })._family).toEqualTypeOf<'NotFound'>();
expectTypeOf<'_family' extends keyof Unauthorized ? true : false>().toEqualTypeOf<false>();
expectTypeOf<FamilyOf<TaskNotFound | Unauthorized>>().toEqualTypeOf<'NotFound'>();
expectTypeOf(new Wrapped({ cause: new Error('root') })).toMatchTypeOf<Error>();

// @ts-expect-error
new DealNotFound();

// @ts-expect-error
new DealNotFound({ dealId: 1 });

// @ts-expect-error
export class ReservedTag extends TaggedError('ReservedTag')<{ _tag: 'Other' }> {}

// @ts-expect-error
export class ReservedFamily extends TaggedError('ReservedFamily')<{ _family: 'Other' }> {}

// @ts-expect-error
export class ReservedName extends TaggedError('ReservedName')<{ name: string }> {}

// @ts-expect-error
export class ReservedStack extends TaggedError('ReservedStack')<{ stack: string }> {}

// @ts-expect-error
export class NumericMessage extends TaggedError('NumericMessage')<{ message: number }> {}

const tagged = new Unauthorized();
// @ts-expect-error
tagged._tag = 'Other';

const family = new TaskNotFound({ taskId: '1' });
// @ts-expect-error
family._family = 'Other';

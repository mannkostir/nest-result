import { expectTypeOf } from 'expect-type';
import { TaggedError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class Unauthorized extends TaggedError('Unauthorized') {}
interface OrderPayload {
  readonly orderId: string;
}
class OrderMissing extends TaggedError('OrderMissing')<OrderPayload> {}

expectTypeOf(new DealNotFound({ dealId: '1' })._tag).toEqualTypeOf<'DealNotFound'>();
expectTypeOf(new DealNotFound({ dealId: '1' }).dealId).toEqualTypeOf<string>();
expectTypeOf(new OrderMissing({ orderId: '1' }).orderId).toEqualTypeOf<string>();
expectTypeOf(new Unauthorized()).toMatchTypeOf<Error>();

// @ts-expect-error
new DealNotFound();

// @ts-expect-error
new DealNotFound({ dealId: 1 });

// @ts-expect-error
export class ReservedTag extends TaggedError('ReservedTag')<{ _tag: 'Other' }> {}

// @ts-expect-error
export class ReservedName extends TaggedError('ReservedName')<{ name: string }> {}

// @ts-expect-error
export class NumericMessage extends TaggedError('NumericMessage')<{ message: number }> {}

const tagged = new Unauthorized();
// @ts-expect-error
tagged._tag = 'Other';

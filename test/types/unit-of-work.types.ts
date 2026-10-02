import { expectTypeOf } from 'expect-type';
import { okAsync, type ResultAsync } from 'neverthrow';
import type { TransactionContext, UnitOfWork } from 'typeorm-unit-of-work';
import { TaggedError } from '../../src/index.js';
import { withResultUnitOfWork } from '../../src/unit-of-work/index.js';

class Rejected extends TaggedError('Rejected') {}

declare const uow: UnitOfWork;
declare const work: ResultAsync<number, Rejected>;

expectTypeOf(withResultUnitOfWork(uow, () => work)).toEqualTypeOf<ResultAsync<number, Rejected>>();

withResultUnitOfWork(uow, (tx) => {
  expectTypeOf(tx).toEqualTypeOf<TransactionContext>();
  return work;
});

// @ts-expect-error
withResultUnitOfWork(uow, () => okAsync(1), { commitWhen: () => true });

// @ts-expect-error
withResultUnitOfWork(uow, () => okAsync(1), { propagation: 'required' });

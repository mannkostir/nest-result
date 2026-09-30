import type { TransactionHost } from '@nestjs-cls/transactional';
import { expectTypeOf } from 'expect-type';
import { ok, okAsync, type Result, type ResultAsync } from 'neverthrow';
import { TaggedError } from '../../src/index.js';
import { TransactionalResult, withResultTransaction } from '../../src/transactional/index.js';

class SomeTaggedError extends TaggedError('SomeTaggedError') {}

declare const host: TransactionHost;

export class DealService {
  @TransactionalResult()
  async promisedResult(): Promise<Result<number, SomeTaggedError>> {
    return ok(1);
  }

  // @ts-expect-error
  @TransactionalResult()
  resultAsync(): ResultAsync<number, SomeTaggedError> {
    return okAsync(1);
  }

  // @ts-expect-error
  @TransactionalResult()
  plainNumber(): number {
    return 1;
  }

  // @ts-expect-error
  @TransactionalResult()
  async promisedNumber(): Promise<number> {
    return 1;
  }
}

expectTypeOf(
  withResultTransaction(host, () => okAsync(1) as ResultAsync<number, SomeTaggedError>),
).toEqualTypeOf<ResultAsync<number, SomeTaggedError>>();

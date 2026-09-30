import type { Propagation, TransactionHost } from '@nestjs-cls/transactional';
import { ResultAsync, type Result } from 'neverthrow';
import { RollbackSignal } from './rollback-signal.js';

export type TransactionOptionsOf<TAdapter> = Parameters<TransactionHost<TAdapter>['withTransaction']>[1];

export type ResultTransactionSettings<TAdapter> = {
  readonly propagation?: Propagation;
  readonly options?: TransactionOptionsOf<TAdapter>;
};

export function withResultTransaction<T, E, TAdapter = never>(
  txHost: TransactionHost<TAdapter>,
  fn: () => PromiseLike<Result<T, E>>,
  settings: ResultTransactionSettings<TAdapter> = {},
): ResultAsync<T, E> {
  return new ResultAsync(runRollingBackOnErr(txHost, fn, settings));
}

async function runRollingBackOnErr<T, E, TAdapter>(
  txHost: TransactionHost<TAdapter>,
  fn: () => PromiseLike<Result<T, E>>,
  settings: ResultTransactionSettings<TAdapter>,
): Promise<Result<T, E>> {
  const owner = Symbol('nest-result transaction');
  try {
    return await startTransaction(txHost, settings, async () => {
      const result = await fn();
      if (result.isErr()) throw new RollbackSignal(owner, result);
      return result;
    });
  } catch (thrown) {
    if (RollbackSignal.isOwnedBy<T, E>(thrown, owner)) return thrown.result;
    throw thrown;
  }
}

function startTransaction<R, TAdapter>(
  txHost: TransactionHost<TAdapter>,
  { propagation, options }: ResultTransactionSettings<TAdapter>,
  fn: () => Promise<R>,
): Promise<R> {
  if (propagation !== undefined && options !== undefined) return txHost.withTransaction(propagation, options, fn);
  if (propagation !== undefined) return txHost.withTransaction(propagation, fn);
  if (options !== undefined) return txHost.withTransaction(options, fn);
  return txHost.withTransaction(fn);
}

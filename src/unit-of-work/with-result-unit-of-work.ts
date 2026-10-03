import { ResultAsync, type Result } from 'neverthrow';

export type UnitOfWorkIsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE'
  | 'SNAPSHOT';

export type UnitOfWorkRunOptions = {
  readonly propagation?: 'join' | 'new' | 'nested';
  readonly isolationLevel?: UnitOfWorkIsolationLevel;
};

export interface UnitOfWorkLike<C> {
  run<R>(
    work: (context: C) => Promise<R>,
    options?: UnitOfWorkRunOptions & { readonly commitWhen?: (result: R) => boolean },
  ): Promise<R>;
}

export function withResultUnitOfWork<C, T, E>(
  uow: UnitOfWorkLike<C>,
  fn: (context: C) => PromiseLike<Result<T, E>>,
  options: UnitOfWorkRunOptions = {},
): ResultAsync<T, E> {
  return new ResultAsync(uow.run(async (context) => fn(context), { ...options, commitWhen: isOk }));
}

function isOk(result: Result<unknown, unknown>): boolean {
  return result.isOk();
}

import type { Err } from 'neverthrow';

export class RollbackSignal<T, E> extends Error {
  constructor(
    readonly owner: symbol,
    readonly result: Err<T, E>,
  ) {
    super('nest-result rollback signal');
    this.name = 'RollbackSignal';
  }

  static isOwnedBy<T, E>(thrown: unknown, owner: symbol): thrown is RollbackSignal<T, E> {
    return thrown instanceof RollbackSignal && thrown.owner === owner;
  }
}

import { Propagation, TransactionHost } from '@nestjs-cls/transactional';
import { copyMethodMetadata } from 'nestjs-cls';
import type { Result } from 'neverthrow';
import { named } from './named.js';
import {
  type ResultTransactionSettings,
  type TransactionOptionsOf,
  withResultTransaction,
} from './with-result-transaction.js';

type AsyncResultMethod = (...args: never[]) => Promise<Result<unknown, unknown>>;

export type TransactionalResultDecorator = <F extends AsyncResultMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F>,
) => void;

type TransactionTarget = {
  readonly connectionName: string | undefined;
  readonly settings: ResultTransactionSettings<unknown>;
};

export function TransactionalResult(): TransactionalResultDecorator;
export function TransactionalResult(propagation: Propagation): TransactionalResultDecorator;
export function TransactionalResult<TAdapter = never>(
  options: TransactionOptionsOf<TAdapter>,
): TransactionalResultDecorator;
export function TransactionalResult<TAdapter = never>(
  propagation: Propagation,
  options: TransactionOptionsOf<TAdapter>,
): TransactionalResultDecorator;
export function TransactionalResult<TAdapter = never>(
  connectionName: string,
  propagation?: Propagation,
  options?: TransactionOptionsOf<TAdapter>,
): TransactionalResultDecorator;
export function TransactionalResult(...args: readonly unknown[]): TransactionalResultDecorator {
  const target = parseArguments(args);
  return (_target, key, descriptor) => {
    const original = descriptor.value;
    if (original === undefined) {
      throw new TypeError(`@TransactionalResult can only decorate methods, but ${String(key)} is not a method`);
    }
    descriptor.value = wrapInTransaction(original, target);
  };
}

function wrapInTransaction<F extends AsyncResultMethod>(original: F, target: TransactionTarget): F {
  const wrapped = async function (this: unknown, ...args: never[]): Promise<Result<unknown, unknown>> {
    return withResultTransaction(
      TransactionHost.getInstance<unknown>(target.connectionName),
      named(() => original.apply(this, args), original.name),
      target.settings,
    );
  };
  named(wrapped, original.name);
  copyMethodMetadata(original, wrapped);
  return wrapped as unknown as F;
}

function parseArguments(args: readonly unknown[]): TransactionTarget {
  const [first, ...rest] = args;
  if (typeof first === 'string' && !isPropagation(first)) {
    return { connectionName: first, settings: settingsFrom(rest) };
  }
  return { connectionName: undefined, settings: settingsFrom(args) };
}

function settingsFrom(args: readonly unknown[]): ResultTransactionSettings<unknown> {
  const [first, second] = args;
  if (isPropagation(first)) return { propagation: first, options: second as TransactionOptionsOf<unknown> };
  return { options: first as TransactionOptionsOf<unknown> };
}

function isPropagation(value: unknown): value is Propagation {
  return (Object.values(Propagation) as readonly unknown[]).includes(value);
}

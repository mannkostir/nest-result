import type { FailWhen, FirstFailure, IdentityChecks } from './checks.js';
import type { MissingKeys, StaleKeys } from './coverage.js';
import { lookupByIdentity, readErrorIdentity } from './error-lookup.js';
import { UnmappedErrorTagError, UntaggedErrorValueError } from './library-errors.js';
import type { MembersWithKey } from './tags.js';

export type MissingErrorHandlers<K> = { readonly __missingErrorHandlers: K };

export type StaleErrorHandlers<K> = { readonly __staleErrorHandlers: K };

export type MatchCheck<E, Keys extends PropertyKey> = FirstFailure<
  [
    ...IdentityChecks<E>,
    FailWhen<MissingKeys<E, Keys>, MissingErrorHandlers<MissingKeys<E, Keys>>>,
    FailWhen<StaleKeys<E, Keys>, StaleErrorHandlers<StaleKeys<E, Keys>>>,
  ]
>;

export type ErrorHandlers<E, K extends PropertyKey> = { readonly [P in K]: (error: MembersWithKey<E, P>) => unknown };

type HandlerResult<H> = H extends (...args: never[]) => infer R ? R : never;

type HandlerTable = Readonly<Record<string, (error: unknown) => unknown>>;

export function matchError<E, K extends PropertyKey, H extends ErrorHandlers<E, K>>(
  error: E,
  handlers: H & ErrorHandlers<E, K> & NoInfer<MatchCheck<E, K>>,
): HandlerResult<H[K]> {
  const identity = readErrorIdentity(error);
  if (identity === undefined) throw UntaggedErrorValueError.forValue(error);
  const handler = lookupByIdentity(identity, [handlerTableOf(handlers)]);
  if (handler === undefined) throw UnmappedErrorTagError.forTag(identity.tag);
  return handler(error) as HandlerResult<H[K]>;
}

function handlerTableOf(handlers: object): HandlerTable {
  return handlers as HandlerTable;
}

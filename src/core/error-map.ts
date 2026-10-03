import type { FailWhen, FirstFailure, IdentityChecks } from './checks.js';
import type { MissingKeys, StaleKeys } from './coverage.js';
import type { ErrorStatus, ErrorStatusOutOfRange, OutOfRangeStatuses } from './error-status.js';
import type { ErrorKeyOf, MembersWithKey } from './tags.js';

export type HttpErrorSpec<E> =
  | ErrorStatus
  | { readonly status: ErrorStatus; readonly body: (error: E) => object };

export type AnyHttpErrorSpec =
  | number
  | { readonly status: number; readonly body: (error: never) => object };

export type AnyErrorMap = { readonly [key: string]: AnyHttpErrorSpec };

export type ErrorMap<E> = { readonly [K in ErrorKeyOf<E>]?: HttpErrorSpec<MembersWithKey<E, K>> };

export type MissingErrorMapKeys<K> = { readonly __missingErrorMapKeys: K };

export type StaleErrorMapKeys<K> = { readonly __staleErrorMapKeys: K };

export type ErrorBodyParameterMismatch<K> = { readonly __errorBodyParameterMismatch: K };

type BodyMismatches<E, M> = {
  [K in keyof M]: M[K] extends { readonly body: (error: infer P) => object }
    ? [MembersWithKey<E, K>] extends [P]
      ? never
      : K
    : never;
}[keyof M];

export type ErrorMapCheck<E, M, D = {}> = FirstFailure<
  [
    ...IdentityChecks<E>,
    FailWhen<MissingKeys<E, keyof M | keyof D>, MissingErrorMapKeys<MissingKeys<E, keyof M | keyof D>>>,
    FailWhen<StaleKeys<E, keyof M>, StaleErrorMapKeys<StaleKeys<E, keyof M>>>,
    FailWhen<OutOfRangeStatuses<M>, ErrorStatusOutOfRange<OutOfRangeStatuses<M>>>,
    FailWhen<
      BodyMismatches<E, M> | BodyMismatches<E, D>,
      ErrorBodyParameterMismatch<BodyMismatches<E, M> | BodyMismatches<E, D>>
    >,
  ]
>;

export type ErrorMapTemplate<E, S> = {
  readonly [K in keyof S]: S[K] | { readonly status: S[K]; readonly body: (error: MembersWithKey<E, K>) => object };
};

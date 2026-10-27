import type { FailWhen, FirstFailure, IdentityChecks } from './checks.js';
import type { MissingKeys, StaleKeys } from './coverage.js';
import type { ErrorStatus, ErrorStatusOutOfRange, OutOfRangeStatuses } from './error-status.js';
import type { ProblemTypeWithoutProblemDetails } from './problem-types.js';
import type { ErrorKeyOf, MembersWithKey } from './tags.js';

export type HttpErrorSpec<E> =
  | ErrorStatus
  | { readonly status: ErrorStatus; readonly body: (error: E) => object }
  | { readonly status: ErrorStatus; readonly type: string; readonly title?: string };

export type AnyCustomBodySpec = { readonly status: number; readonly body: (error: never) => object };

export type AnyProblemTypeSpec = { readonly status: number; readonly type: string; readonly title?: string };

export type AnyHttpErrorSpec = number | AnyCustomBodySpec | AnyProblemTypeSpec;

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

type CustomBodyTemplate<E, K, N> = {
  readonly status: N;
  readonly body: (error: MembersWithKey<E, K>) => object;
  readonly type?: never;
  readonly title?: never;
};

type ProblemTypeTemplate<N, T> = { readonly status: N; readonly type: T; readonly title?: string };

export type ErrorMapTemplate<E, S> = {
  readonly [K in keyof S]:
    | S[K]
    | CustomBodyTemplate<E, K, S[K]>
    | ProblemTypeTemplate<S[K], ProblemTypeWithoutProblemDetails<K>>;
};

export type ProblemDetailsMapTemplate<E, S> = {
  readonly [K in keyof S]: S[K] | CustomBodyTemplate<E, K, S[K]> | ProblemTypeTemplate<S[K], string>;
};

export type ErrorMapTemplateFor<E, S, F> = [F] extends ['problem-details']
  ? ProblemDetailsMapTemplate<E, S>
  : ErrorMapTemplate<E, S>;

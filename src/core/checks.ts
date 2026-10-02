import type { AmbiguousKeys } from './coverage.js';
import type { UntaggedMember } from './tags.js';

export type UntaggedErrorsCannotBeMapped<U> = { readonly __untaggedErrorsCannotBeMapped: U };

export type AmbiguousErrorKeys<N> = { readonly __ambiguousErrorKeys: N };

export type FailWhen<Keys, Marker> = [Keys] extends [never] ? unknown : Marker;

export type FirstFailure<Checks extends readonly unknown[]> = Checks extends readonly [infer First, ...infer Rest]
  ? unknown extends First
    ? FirstFailure<Rest>
    : First
  : unknown;

export type IdentityChecks<E> = [
  FailWhen<UntaggedMember<E>, UntaggedErrorsCannotBeMapped<UntaggedMember<E>>>,
  FailWhen<AmbiguousKeys<E>, AmbiguousErrorKeys<AmbiguousKeys<E>>>,
];

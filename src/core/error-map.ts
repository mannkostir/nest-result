import type { TagOf, UntaggedMember } from './tags.js';

export type HttpErrorSpec<E> =
  | number
  | { readonly status: number; readonly body: (error: E) => object };

export type AnyHttpErrorSpec =
  | number
  | { readonly status: number; readonly body: (error: never) => object };

export type AnyErrorMap = { readonly [tag: string]: AnyHttpErrorSpec };

export type UntaggedErrorsCannotBeMapped<U> = { readonly __untaggedErrorsCannotBeMapped: U };

export type MissingErrorMapKeys<K> = { readonly __missingErrorMapKeys: K };

export type StaleErrorMapKeys<K> = { readonly __staleErrorMapKeys: K };

export type ErrorBodyParameterMismatch<M> = { readonly __errorBodyParameterMismatch: M };

export type ErrorMap<E> = [UntaggedMember<E>] extends [never]
  ? { readonly [K in TagOf<E>]: HttpErrorSpec<Extract<E, { readonly _tag: K }>> }
  : UntaggedErrorsCannotBeMapped<UntaggedMember<E>>;

type StaleKeys<E, M> = Exclude<keyof M, TagOf<E>>;

type MissingKeys<E, M> = Exclude<TagOf<E>, keyof M>;

export type ExactErrorMap<E, M> = M &
  ([StaleKeys<E, M>] extends [never] ? unknown : StaleErrorMapKeys<StaleKeys<E, M>>);

export type ErrorMapCheck<E, M> = [UntaggedMember<E>] extends [never]
  ? [MissingKeys<E, M>] extends [never]
    ? [StaleKeys<E, M>] extends [never]
      ? M extends ErrorMap<E>
        ? unknown
        : ErrorBodyParameterMismatch<M>
      : StaleErrorMapKeys<StaleKeys<E, M>>
    : MissingErrorMapKeys<MissingKeys<E, M>>
  : UntaggedErrorsCannotBeMapped<UntaggedMember<E>>;

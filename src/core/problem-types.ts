import type { FailWhen } from './checks.js';
import type { ErrorBodyFormat } from './error-defaults.js';
import type { AnyCustomBodySpec, AnyHttpErrorSpec, AnyProblemTypeSpec } from './error-map.js';
import { reasonPhraseOf } from './reason-phrases.js';

export type ProblemTypeWithoutProblemDetails<K> = { readonly __problemTypeWithoutProblemDetails: K };

type IsProblemTypeSpec<S> = S extends { readonly type: string }
  ? S extends { readonly body: unknown }
    ? false
    : true
  : false;

export type ProblemTypeKeys<M> = { [K in keyof M]-?: true extends IsProblemTypeSpec<M[K]> ? K : never }[keyof M];

export type ProblemTypesCheck<M, F extends ErrorBodyFormat> = [F] extends ['problem-details']
  ? unknown
  : FailWhen<ProblemTypeKeys<M>, ProblemTypeWithoutProblemDetails<ProblemTypeKeys<M>>>;

export type ProblemType = { readonly status: number; readonly type: string; readonly title: string };

export function problemTypeOf(spec: number | AnyProblemTypeSpec): ProblemType {
  if (typeof spec === 'number') return { status: spec, type: 'about:blank', title: reasonPhraseOf(spec) };
  return { status: spec.status, type: spec.type, title: spec.title ?? reasonPhraseOf(spec.status) };
}

export function isCustomBodySpec(spec: AnyHttpErrorSpec): spec is AnyCustomBodySpec {
  return typeof spec !== 'number' && 'body' in spec;
}

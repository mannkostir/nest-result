import type { AnyErrorMap, AnyHttpErrorSpec } from './error-map.js';
import { InvalidErrorStatusError } from './library-errors.js';

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

type ToNumber<S> = S extends `${infer N extends number}` ? N : never;

export type ErrorStatus = ToNumber<`${4 | 5}${Digit}${Digit}`>;

export type ErrorStatusOutOfRange<S> = { readonly __errorStatusOutOfRange: S };

type StatusOfSpec<S> = S extends { readonly status: infer N } ? N : S;

export type OutOfRangeStatuses<M> = {
  [K in keyof M]: StatusOfSpec<M[K]> extends ErrorStatus ? never : StatusOfSpec<M[K]>;
}[keyof M];

export function isErrorStatus(value: unknown): value is ErrorStatus {
  return Number.isInteger(value) && (value as number) >= 400 && (value as number) <= 599;
}

export function statusOf(spec: AnyHttpErrorSpec): number {
  return typeof spec === 'number' ? spec : spec.status;
}

export function assertErrorStatuses(map: AnyErrorMap): void {
  const invalid = Object.entries(map).find(([, spec]) => !isErrorStatus(statusOf(spec)));
  if (invalid !== undefined) throw InvalidErrorStatusError.forKey(invalid[0], statusOf(invalid[1]));
}

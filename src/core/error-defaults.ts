import type { FirstFailure } from './checks.js';
import type { AnyErrorMap } from './error-map.js';
import { assertErrorStatuses, type ErrorStatusOutOfRange, type OutOfRangeStatuses } from './error-status.js';
import type { ProblemTypesCheck } from './problem-types.js';

declare const errorDefaultsBrand: unique symbol;

declare const bodyFormatBrand: unique symbol;

export type ErrorBodyFormat = 'plain' | 'problem-details';

export type ErrorDefaults<D, F extends ErrorBodyFormat = ErrorBodyFormat> = Readonly<D> & {
  readonly [errorDefaultsBrand]: true;
  [bodyFormatBrand](format: F): void;
};

export type ErrorDefaultsOptions = { readonly body?: 'problem-details' };

type DeclaredFormat<O> = O extends { readonly body: 'problem-details' } ? 'problem-details' : ErrorBodyFormat;

type CheckedFormat<O> = O extends { readonly body: 'problem-details' } ? 'problem-details' : 'plain';

type StatusCheck<D> = [OutOfRangeStatuses<D>] extends [never] ? unknown : ErrorStatusOutOfRange<OutOfRangeStatuses<D>>;

const bodyFormatKey = Symbol('bodyFormat');

export function errorDefaults<const D extends AnyErrorMap, const O extends ErrorDefaultsOptions = {}>(
  defaults: D & FirstFailure<[StatusCheck<D>, ProblemTypesCheck<D, CheckedFormat<O>>]>,
  options?: O,
): ErrorDefaults<D, DeclaredFormat<O>> {
  assertErrorStatuses(defaults);
  const format = options?.body === undefined ? {} : { [bodyFormatKey]: options.body };
  return Object.freeze({ ...defaults, ...format }) as unknown as ErrorDefaults<D, DeclaredFormat<O>>;
}

export function bodyFormatOf(defaults: object): ErrorBodyFormat {
  const format: unknown = (defaults as { readonly [bodyFormatKey]?: unknown })[bodyFormatKey];
  return format === 'problem-details' ? 'problem-details' : 'plain';
}

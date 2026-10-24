import type { AnyErrorMap } from './error-map.js';
import { assertErrorStatuses, type ErrorStatusOutOfRange, type OutOfRangeStatuses } from './error-status.js';

declare const errorDefaultsBrand: unique symbol;

export type ErrorDefaults<D> = Readonly<D> & { readonly [errorDefaultsBrand]: true };

export type ErrorBodyFormat = 'plain' | 'problem-details';

export type ErrorDefaultsOptions = { readonly body?: 'problem-details' };

const bodyFormatKey = Symbol('bodyFormat');

export function errorDefaults<const D extends AnyErrorMap>(
  defaults: D & ([OutOfRangeStatuses<D>] extends [never] ? unknown : ErrorStatusOutOfRange<OutOfRangeStatuses<D>>),
  options: ErrorDefaultsOptions = {},
): ErrorDefaults<D> {
  assertErrorStatuses(defaults);
  const format = options.body === undefined ? {} : { [bodyFormatKey]: options.body };
  return Object.freeze({ ...defaults, ...format }) as unknown as ErrorDefaults<D>;
}

export function bodyFormatOf(defaults: object): ErrorBodyFormat {
  const format: unknown = (defaults as { readonly [bodyFormatKey]?: unknown })[bodyFormatKey];
  return format === 'problem-details' ? 'problem-details' : 'plain';
}

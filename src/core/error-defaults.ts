import type { AnyErrorMap } from './error-map.js';
import { assertErrorStatuses, type ErrorStatusOutOfRange, type OutOfRangeStatuses } from './error-status.js';

declare const errorDefaultsBrand: unique symbol;

export type ErrorDefaults<D> = Readonly<D> & { readonly [errorDefaultsBrand]: true };

export function errorDefaults<const D extends AnyErrorMap>(
  defaults: D & ([OutOfRangeStatuses<D>] extends [never] ? unknown : ErrorStatusOutOfRange<OutOfRangeStatuses<D>>),
): ErrorDefaults<D> {
  assertErrorStatuses(defaults);
  return Object.freeze({ ...defaults }) as unknown as ErrorDefaults<D>;
}

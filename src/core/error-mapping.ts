import type { AnyErrorMap } from './error-map.js';
import { assertErrorStatuses } from './error-status.js';

export type ErrorMapping = { readonly map: AnyErrorMap; readonly defaults: AnyErrorMap };

export function errorMappingOf(map: object, defaults: object = {}): ErrorMapping {
  const mapping = { map: map as AnyErrorMap, defaults: defaults as AnyErrorMap };
  assertErrorStatuses(mapping.map);
  assertErrorStatuses(mapping.defaults);
  return mapping;
}

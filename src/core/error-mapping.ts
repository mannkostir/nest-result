import type { AnyErrorMap } from './error-map.js';

export type ErrorMapping = { readonly map: AnyErrorMap; readonly defaults: AnyErrorMap };

export function errorMappingOf(map: object, defaults: object = {}): ErrorMapping {
  return { map: map as AnyErrorMap, defaults: defaults as AnyErrorMap };
}

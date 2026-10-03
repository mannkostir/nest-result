import { ApiResponse } from '@nestjs/swagger';
import type { UsedDefaultKeys } from '../core/coverage.js';
import type { ErrorDefaults } from '../core/error-defaults.js';
import type { AnyErrorMap, ErrorMapCheck } from '../core/error-map.js';
import { errorMappingOf, type ErrorMapping } from '../core/error-mapping.js';
import { statusOf } from '../core/error-status.js';
import type { ErrorOfReturn, ResultReturningMethod } from '../core/result-source.js';
import { applyErrorMap } from '../http/apply-error-map.js';
import type { MapErrorsDecorator } from '../http/map-errors.decorator.js';

export type MissingDefaultUses<K> = { readonly __missingDefaultUses: K };

export type StaleDefaultUses<K> = { readonly __staleDefaultUses: K };

type DefaultUsesCheck<E, M, D, U> = [Exclude<UsedDefaultKeys<E, keyof M, keyof D>, U>] extends [never]
  ? [Exclude<U, UsedDefaultKeys<E, keyof M, keyof D>>] extends [never]
    ? unknown
    : StaleDefaultUses<Exclude<U, UsedDefaultKeys<E, keyof M, keyof D>>>
  : MissingDefaultUses<Exclude<UsedDefaultKeys<E, keyof M, keyof D>, U>>;

export type DocumentedDefaults<U extends string> = { readonly uses: readonly U[] };

export type DocumentedMapErrorsDecorator<M, D, U> = <F extends ResultReturningMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F> &
    ErrorMapCheck<ErrorOfReturn<ReturnType<F>>, M, D> &
    DefaultUsesCheck<ErrorOfReturn<ReturnType<F>>, M, D, U>,
) => void;

export type DocumentedMapErrorsWithDefaults<D> = <const M extends AnyErrorMap, const U extends keyof D & string = never>(
  map: M,
  documentation: DocumentedDefaults<U>,
) => DocumentedMapErrorsDecorator<M, D, U>;

type Decorate = (target: object, key: string | symbol, descriptor: PropertyDescriptor) => void;

function documentedMapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M> {
  return documentWith(errorMappingOf(map), map);
}

function withDefaults<D extends AnyErrorMap>(defaults: ErrorDefaults<D>): DocumentedMapErrorsWithDefaults<D> {
  return (map, { uses }) => documentWith(errorMappingOf(map, defaults), { ...pickKeys(defaults, uses), ...map });
}

function documentWith(mapping: ErrorMapping, documented: AnyErrorMap): Decorate {
  return (target, key, descriptor) => {
    applyErrorMap(mapping, target, key, descriptor);
    keysByStatus(documented).forEach((keys, status) =>
      ApiResponse({ status, description: keys.join(', ') })(target, key, descriptor),
    );
  };
}

function pickKeys(map: AnyErrorMap, keys: readonly string[]): AnyErrorMap {
  return Object.fromEntries(Object.entries(map).filter(([key]) => keys.includes(key)));
}

function keysByStatus(map: AnyErrorMap): ReadonlyMap<number, readonly string[]> {
  return Object.entries(map).reduce((groups, [key, spec]) => {
    const status = statusOf(spec);
    return new Map(groups).set(status, [...(groups.get(status) ?? []), key]);
  }, new Map<number, readonly string[]>());
}

export const MapErrors = Object.assign(documentedMapErrors, { withDefaults });

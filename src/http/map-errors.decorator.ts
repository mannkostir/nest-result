import type { ErrorDefaults } from '../core/error-defaults.js';
import type { AnyErrorMap, ErrorMapCheck } from '../core/error-map.js';
import { errorMappingOf, type ErrorMapping } from '../core/error-mapping.js';
import type { ErrorOfReturn, ResultReturningMethod } from '../core/result-source.js';
import { applyErrorMap } from './apply-error-map.js';

export type MapErrorsDecorator<M, D = {}> = <F extends ResultReturningMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F> & ErrorMapCheck<ErrorOfReturn<ReturnType<F>>, M, D>,
) => void;

export type MapErrorsWithDefaults<D> = <const M extends AnyErrorMap>(map: M) => MapErrorsDecorator<M, D>;

function mapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M> {
  return decorateWith(errorMappingOf(map));
}

function withDefaults<D extends AnyErrorMap>(defaults: ErrorDefaults<D>): MapErrorsWithDefaults<D> {
  return (map) => decorateWith(errorMappingOf(map, defaults));
}

function decorateWith(
  mapping: ErrorMapping,
): (target: object, key: string | symbol, descriptor: PropertyDescriptor) => void {
  return (target, key, descriptor) => applyErrorMap(mapping, target, key, descriptor);
}

export const MapErrors = Object.assign(mapErrors, { withDefaults });

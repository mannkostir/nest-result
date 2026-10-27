import type { ErrorBodyFormat, ErrorDefaults } from '../core/error-defaults.js';
import type { AnyErrorMap, ErrorMapCheck } from '../core/error-map.js';
import { errorMappingOf, type ErrorMapping } from '../core/error-mapping.js';
import type { ProblemTypesCheck } from '../core/problem-types.js';
import type { ErrorOfReturn, ResultReturningMethod } from '../core/result-source.js';
import { applyErrorMap } from './apply-error-map.js';

export type MapErrorsDecorator<M, D = {}, P extends ErrorBodyFormat = 'plain'> = <F extends ResultReturningMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F> & ErrorMapCheck<ErrorOfReturn<ReturnType<F>>, M, D> & ProblemTypesCheck<M, P>,
) => void;

export type MapErrorsWithDefaults<D, F extends ErrorBodyFormat = ErrorBodyFormat> = <const M extends AnyErrorMap>(
  map: M,
) => MapErrorsDecorator<M, D, F>;

function mapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M> {
  return decorateWith(errorMappingOf(map));
}

function withDefaults<D extends AnyErrorMap, F extends ErrorBodyFormat = ErrorBodyFormat>(
  defaults: ErrorDefaults<D, F>,
): MapErrorsWithDefaults<D, F> {
  return (map) => decorateWith(errorMappingOf(map, defaults));
}

function decorateWith(
  mapping: ErrorMapping,
): (target: object, key: string | symbol, descriptor: PropertyDescriptor) => void {
  return (target, key, descriptor) => applyErrorMap(mapping, target, key, descriptor);
}

export const MapErrors = Object.assign(mapErrors, { withDefaults });

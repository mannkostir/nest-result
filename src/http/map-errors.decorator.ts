import type { AnyErrorMap, ErrorMapCheck } from '../core/error-map.js';
import { errorMappingOf } from '../core/error-mapping.js';
import type { ErrorOfReturn, ResultReturningMethod } from '../core/result-source.js';
import { applyErrorMap } from './apply-error-map.js';

export type MapErrorsDecorator<M, D = {}> = <F extends ResultReturningMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F> & ErrorMapCheck<ErrorOfReturn<ReturnType<F>>, M, D>,
) => void;

export function MapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M> {
  const mapping = errorMappingOf(map);
  return (target, key, descriptor) => applyErrorMap(mapping, target, key, descriptor);
}

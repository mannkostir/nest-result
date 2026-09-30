import type { AnyErrorMap, ErrorMapCheck } from '../core/error-map.js';
import type { ErrorOfReturn, ResultReturningMethod } from '../core/result-source.js';
import { applyErrorMap } from './apply-error-map.js';

export type MapErrorsDecorator<M> = <F extends ResultReturningMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F> & ErrorMapCheck<ErrorOfReturn<ReturnType<F>>, M>,
) => void;

export function MapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M> {
  return (target, key, descriptor) => applyErrorMap(map, target, key, descriptor);
}

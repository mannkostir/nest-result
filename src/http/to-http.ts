import type { ErrorMapCheck, ErrorMapTemplate } from '../core/error-map.js';
import { errorMappingOf } from '../core/error-mapping.js';
import type { ResultSource } from '../core/result-source.js';
import { exceptionFor } from './exception-for.js';

export async function toHttp<T, E, const S>(
  source: ResultSource<T, E>,
  map: ErrorMapTemplate<E, S> & NoInfer<ErrorMapCheck<E, S>>,
): Promise<T> {
  const mapping = errorMappingOf(map);
  const result = await source;
  if (result.isErr()) throw exceptionFor(result.error, mapping);
  return result.value;
}

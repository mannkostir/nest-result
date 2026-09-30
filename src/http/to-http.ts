import type { AnyErrorMap, ErrorMap, ExactErrorMap } from '../core/error-map.js';
import type { ResultSource } from '../core/result-source.js';
import { exceptionFor } from './exception-for.js';

export async function toHttp<T, E, const M extends ErrorMap<E>>(
  source: ResultSource<T, E>,
  map: ExactErrorMap<E, M>,
): Promise<T> {
  const result = await source;
  if (result.isErr()) throw exceptionFor(result.error, map as AnyErrorMap);
  return result.value;
}

import type { ErrorBodyFormat, ErrorDefaults } from '../core/error-defaults.js';
import type { ErrorMapCheck, ErrorMapTemplateFor } from '../core/error-map.js';
import { errorMappingOf } from '../core/error-mapping.js';
import type { ResultSource } from '../core/result-source.js';
import { exceptionFor } from './exception-for.js';

export async function toHttp<T, E, const S, D = {}, F extends ErrorBodyFormat = ErrorBodyFormat>(
  source: ResultSource<T, E>,
  map: ErrorMapTemplateFor<E, S, F> & NoInfer<ErrorMapCheck<E, S, D>>,
  defaults?: ErrorDefaults<D, F>,
): Promise<T> {
  const mapping = errorMappingOf(map, defaults);
  const result = await source;
  if (result.isErr()) {
    throw exceptionFor(result.error, mapping).match(
      (exception) => exception,
      (libraryError) => libraryError,
    );
  }
  return result.value;
}

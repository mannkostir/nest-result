import { HttpException } from '@nestjs/common';
import type { ErrorBodyFormat, ErrorDefaults } from '../core/error-defaults.js';
import type { ErrorMapCheck, ErrorMapTemplateFor } from '../core/error-map.js';
import { type ErrorMapping, errorMappingOf } from '../core/error-mapping.js';
import type { UnmappedErrorTagError, UntaggedErrorValueError } from '../core/library-errors.js';
import { resolveHttpError } from '../core/resolve-http-error.js';
import type { ResultSource } from '../core/result-source.js';

export async function toHttp<T, E, const S, D = {}, F extends ErrorBodyFormat = ErrorBodyFormat>(
  source: ResultSource<T, E>,
  map: ErrorMapTemplateFor<E, S, F> & NoInfer<ErrorMapCheck<E, S, D>>,
  defaults?: ErrorDefaults<D, F>,
): Promise<T> {
  const mapping = errorMappingOf(map, defaults);
  const result = await source;
  if (result.isErr()) throw rejectionFor(result.error, mapping);
  return result.value;
}

function rejectionFor(
  error: unknown,
  mapping: ErrorMapping,
): HttpException | UnmappedErrorTagError | UntaggedErrorValueError {
  return resolveHttpError(error, mapping).match(
    ({ status, body }) => new HttpException(body, status, { cause: error }),
    (libraryError) => libraryError,
  );
}

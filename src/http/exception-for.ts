import { HttpException } from '@nestjs/common';
import type { AnyErrorMap } from '../core/error-map.js';
import type { UnmappedErrorTagError, UntaggedErrorValueError } from '../core/library-errors.js';
import { resolveHttpError } from '../core/resolve-http-error.js';

export function exceptionFor(
  error: unknown,
  map: AnyErrorMap,
): HttpException | UnmappedErrorTagError | UntaggedErrorValueError {
  return resolveHttpError(error, map).match(
    ({ status, body }) => new HttpException(body, status, { cause: error }),
    (libraryError) => libraryError,
  );
}

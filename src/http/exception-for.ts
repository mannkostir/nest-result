import { HttpException } from '@nestjs/common';
import type { ErrorMapping } from '../core/error-mapping.js';
import type { UnmappedErrorTagError, UntaggedErrorValueError } from '../core/library-errors.js';
import { resolveHttpError } from '../core/resolve-http-error.js';

export function exceptionFor(
  error: unknown,
  mapping: ErrorMapping,
): HttpException | UnmappedErrorTagError | UntaggedErrorValueError {
  return resolveHttpError(error, mapping).match(
    ({ status, body }) => new HttpException(body, status, { cause: error }),
    (libraryError) => libraryError,
  );
}

import { HttpException } from '@nestjs/common';
import type { Result } from 'neverthrow';
import type { ErrorMapping } from '../core/error-mapping.js';
import type { UnmappedErrorTagError, UntaggedErrorValueError } from '../core/library-errors.js';
import { resolveHttpError } from '../core/resolve-http-error.js';

export function exceptionFor(
  error: unknown,
  mapping: ErrorMapping,
): Result<HttpException, UnmappedErrorTagError | UntaggedErrorValueError> {
  return resolveHttpError(error, mapping).map(({ status, body }) => new HttpException(body, status, { cause: error }));
}

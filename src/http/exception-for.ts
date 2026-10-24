import { HttpException } from '@nestjs/common';
import type { Result } from 'neverthrow';
import type { ErrorMapping } from '../core/error-mapping.js';
import type { UnmappedErrorTagError, UntaggedErrorValueError } from '../core/library-errors.js';
import { resolveHttpError } from '../core/resolve-http-error.js';

export type MappedHttpException = { readonly exception: HttpException; readonly problemDetails: boolean };

export function exceptionFor(
  error: unknown,
  mapping: ErrorMapping,
  instance?: string,
): Result<MappedHttpException, UnmappedErrorTagError | UntaggedErrorValueError> {
  return resolveHttpError(error, mapping, instance).map(({ status, body, problemDetails }) => ({
    exception: new HttpException(body, status, { cause: error }),
    problemDetails,
  }));
}

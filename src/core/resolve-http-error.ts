import { err, ok, type Result } from 'neverthrow';
import type { AnyHttpErrorSpec } from './error-map.js';
import { lookupByIdentity, readErrorIdentity } from './error-lookup.js';
import type { ErrorMapping } from './error-mapping.js';
import { UnmappedErrorTagError, UntaggedErrorValueError } from './library-errors.js';

export type HttpErrorResponse = { readonly status: number; readonly body: object };

export function resolveHttpError(
  error: unknown,
  mapping: ErrorMapping,
): Result<HttpErrorResponse, UnmappedErrorTagError | UntaggedErrorValueError> {
  const identity = readErrorIdentity(error);
  if (identity === undefined) return err(UntaggedErrorValueError.forValue(error));
  const spec = lookupByIdentity(identity, [mapping.map, mapping.defaults]);
  if (spec === undefined) return err(UnmappedErrorTagError.forTag(identity.tag));
  return ok(toResponse(spec, identity.tag, error));
}

function toResponse(spec: AnyHttpErrorSpec, tag: string, error: unknown): HttpErrorResponse {
  if (typeof spec === 'number') return { status: spec, body: defaultBody(spec, tag, error) };
  return { status: spec.status, body: spec.body(error as never) };
}

function defaultBody(status: number, tag: string, error: unknown): object {
  return { statusCode: status, code: tag, message: readMessage(error) ?? tag };
}

function readMessage(error: unknown): string | undefined {
  const message: unknown = (error as { readonly message?: unknown }).message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

import { err, ok, type Result } from 'neverthrow';
import type { AnyHttpErrorSpec } from './error-map.js';
import { lookupByIdentity, readErrorIdentity } from './error-lookup.js';
import type { ErrorMapping } from './error-mapping.js';
import { isCustomBodySpec, statusOf } from './error-status.js';
import { UnmappedErrorTagError, UntaggedErrorValueError } from './library-errors.js';
import { problemTypeOf, type ProblemType } from './problem-types.js';

export type HttpErrorResponse = { readonly status: number; readonly body: object; readonly problemDetails: boolean };

export function resolveHttpError(
  error: unknown,
  mapping: ErrorMapping,
  instance?: string,
): Result<HttpErrorResponse, UnmappedErrorTagError | UntaggedErrorValueError> {
  const identity = readErrorIdentity(error);
  if (identity === undefined) return err(UntaggedErrorValueError.forValue(error));
  const spec = lookupByIdentity(identity, [mapping.map, mapping.defaults]);
  if (spec === undefined) return err(UnmappedErrorTagError.forTag(identity.tag));
  return ok(toResponse(spec, identity.tag, error, mapping, instance));
}

function toResponse(
  spec: AnyHttpErrorSpec,
  tag: string,
  error: unknown,
  mapping: ErrorMapping,
  instance: string | undefined,
): HttpErrorResponse {
  if (isCustomBodySpec(spec)) {
    return { status: spec.status, body: spec.body(error as never), problemDetails: false };
  }
  const status = statusOf(spec);
  if (mapping.bodyFormat === 'problem-details') {
    return { status, body: problemBody(problemTypeOf(spec), tag, error, instance), problemDetails: true };
  }
  return { status, body: defaultBody(status, tag, error), problemDetails: false };
}

function defaultBody(status: number, tag: string, error: unknown): object {
  return { statusCode: status, code: tag, message: readMessage(error) ?? tag };
}

function problemBody(
  { status, type, title }: ProblemType,
  tag: string,
  error: unknown,
  instance: string | undefined,
): object {
  const detail = readMessage(error) ?? tag;
  const body = { type, title, status, detail, code: tag };
  return instance === undefined ? body : { ...body, instance };
}

function readMessage(error: unknown): string | undefined {
  const message: unknown = (error as { readonly message?: unknown }).message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

import { err, ok, type Result } from 'neverthrow';
import type { AnyHttpErrorSpec } from './error-map.js';
import { lookupByIdentity, readErrorIdentity } from './error-lookup.js';
import type { ErrorMapping } from './error-mapping.js';
import { UnmappedErrorTagError, UntaggedErrorValueError } from './library-errors.js';
import { reasonPhraseOf } from './reason-phrases.js';

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
  if (typeof spec !== 'number') return { status: spec.status, body: spec.body(error as never), problemDetails: false };
  if (mapping.bodyFormat === 'problem-details') {
    return { status: spec, body: problemBody(spec, tag, error, instance), problemDetails: true };
  }
  return { status: spec, body: defaultBody(spec, tag, error), problemDetails: false };
}

function defaultBody(status: number, tag: string, error: unknown): object {
  return { statusCode: status, code: tag, message: readMessage(error) ?? tag };
}

function problemBody(status: number, tag: string, error: unknown, instance: string | undefined): object {
  const body = { type: 'about:blank', title: reasonPhraseOf(status), status, detail: readMessage(error) ?? tag, code: tag };
  return instance === undefined ? body : { ...body, instance };
}

function readMessage(error: unknown): string | undefined {
  const message: unknown = (error as { readonly message?: unknown }).message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

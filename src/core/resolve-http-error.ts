import { err, ok, type Result } from 'neverthrow';
import type { AnyErrorMap, AnyHttpErrorSpec } from './error-map.js';
import { UnmappedErrorTagError, UntaggedErrorValueError } from './library-errors.js';

export type HttpErrorResponse = { readonly status: number; readonly body: object };

export function resolveHttpError(
  error: unknown,
  map: AnyErrorMap,
): Result<HttpErrorResponse, UnmappedErrorTagError | UntaggedErrorValueError> {
  const tag = readTag(error);
  if (tag === undefined) return err(UntaggedErrorValueError.forValue(error));
  const spec = Object.hasOwn(map, tag) ? map[tag] : undefined;
  if (spec === undefined) return err(UnmappedErrorTagError.forTag(tag));
  return ok(toResponse(spec, tag, error));
}

export function statusOf(spec: AnyHttpErrorSpec): number {
  return typeof spec === 'number' ? spec : spec.status;
}

function toResponse(spec: AnyHttpErrorSpec, tag: string, error: unknown): HttpErrorResponse {
  if (typeof spec === 'number') return { status: spec, body: defaultBody(spec, tag, error) };
  return { status: spec.status, body: spec.body(error as never) };
}

function defaultBody(status: number, tag: string, error: unknown): object {
  return { statusCode: status, code: tag, message: readMessage(error) ?? tag };
}

function readTag(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const tag: unknown = (error as { readonly _tag?: unknown })._tag;
  return typeof tag === 'string' ? tag : undefined;
}

function readMessage(error: unknown): string | undefined {
  const message: unknown = (error as { readonly message?: unknown }).message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

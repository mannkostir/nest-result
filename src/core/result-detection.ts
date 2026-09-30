import { Err, Ok, ResultAsync, type Result } from 'neverthrow';

export function isResult(value: unknown): value is Result<unknown, unknown> {
  return value instanceof Ok || value instanceof Err;
}

export function isResultAsync(value: unknown): value is ResultAsync<unknown, unknown> {
  return value instanceof ResultAsync;
}

export function looksLikeForeignResult(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  const hasSyncShape = typeof candidate['isOk'] === 'function' && typeof candidate['isErr'] === 'function';
  const hasAsyncShape =
    typeof candidate['then'] === 'function' &&
    typeof candidate['andThen'] === 'function' &&
    typeof candidate['mapErr'] === 'function';
  return hasSyncShape || hasAsyncShape;
}

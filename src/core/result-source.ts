import type { Result, ResultAsync } from 'neverthrow';

export type ResultSource<T, E> = Result<T, E> | ResultAsync<T, E> | Promise<Result<T, E>>;

export type ResultReturningMethod = (...args: never[]) => ResultSource<unknown, unknown>;

export type ErrorOfReturn<R> =
  R extends ResultAsync<unknown, infer E>
    ? E
    : R extends Promise<infer P>
      ? P extends Result<unknown, infer E>
        ? E
        : never
      : R extends Result<unknown, infer E>
        ? E
        : never;

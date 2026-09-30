import { TaggedError } from './tagged-error.js';

export class UnmappedErrorTagError extends TaggedError('UnmappedErrorTagError')<{
  readonly tag: string;
  readonly message: string;
}> {
  static forTag(tag: string): UnmappedErrorTagError {
    return new UnmappedErrorTagError({ tag, message: `No HTTP mapping exists for error tag "${tag}"` });
  }
}

export class UntaggedErrorValueError extends TaggedError('UntaggedErrorValueError')<{
  readonly value: unknown;
  readonly message: string;
}> {
  static forValue(value: unknown): UntaggedErrorValueError {
    return new UntaggedErrorValueError({ value, message: 'An Err value without a string _tag cannot be mapped to HTTP' });
  }
}

export class MissingErrorMapError extends TaggedError('MissingErrorMapError')<{
  readonly handler: string;
  readonly message: string;
}> {
  static forHandler(handler: string): MissingErrorMapError {
    return new MissingErrorMapError({ handler, message: `${handler} returned a Result but has no @MapErrors` });
  }
}

export class DuplicateNeverthrowError extends TaggedError('DuplicateNeverthrowError')<{
  readonly handler: string;
  readonly message: string;
}> {
  static forHandler(handler: string): DuplicateNeverthrowError {
    return new DuplicateNeverthrowError({
      handler,
      message: `${handler} returned a Result from a different copy of neverthrow; deduplicate neverthrow in your dependency tree`,
    });
  }
}

export { TaggedError } from './core/tagged-error.js';
export type { TaggedErrorClass, TaggedErrorInstance, TaggedErrorPayload } from './core/tagged-error.js';
export type { Tagged, TagOf } from './core/tags.js';
export type {
  ErrorBodyParameterMismatch,
  ErrorMap,
  HttpErrorSpec,
  MissingErrorMapKeys,
  StaleErrorMapKeys,
  UntaggedErrorsCannotBeMapped,
} from './core/error-map.js';
export {
  DuplicateNeverthrowError,
  MissingErrorMapError,
  UnmappedErrorTagError,
  UntaggedErrorValueError,
} from './core/library-errors.js';
export { toHttp } from './http/to-http.js';
export { MapErrors } from './http/map-errors.decorator.js';
export type { MapErrorsDecorator } from './http/map-errors.decorator.js';
export { ResultInterceptor } from './http/result.interceptor.js';
export { ResultModule } from './http/result.module.js';

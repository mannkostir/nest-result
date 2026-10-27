export { TaggedError } from './core/tagged-error.js';
export type {
  TaggedErrorClass,
  TaggedErrorInstance,
  TaggedErrorOptions,
  TaggedErrorPayload,
} from './core/tagged-error.js';
export type { FamilyOf, Tagged, TagOf } from './core/tags.js';
export type { AmbiguousErrorKeys, UntaggedErrorsCannotBeMapped } from './core/checks.js';
export type {
  ErrorBodyParameterMismatch,
  ErrorMap,
  HttpErrorSpec,
  MissingErrorMapKeys,
  StaleErrorMapKeys,
} from './core/error-map.js';
export type { ErrorStatus, ErrorStatusOutOfRange } from './core/error-status.js';
export type { ProblemTypeWithoutProblemDetails } from './core/problem-types.js';
export {
  DuplicateNeverthrowError,
  InvalidErrorStatusError,
  MissingErrorMapError,
  ResultInterceptorOrderError,
  UnmappedErrorTagError,
  UntaggedErrorValueError,
} from './core/library-errors.js';
export { errorDefaults } from './core/error-defaults.js';
export type { ErrorDefaults } from './core/error-defaults.js';
export { toHttp } from './http/to-http.js';
export { MapErrors } from './http/map-errors.decorator.js';
export type { MapErrorsDecorator, MapErrorsWithDefaults } from './http/map-errors.decorator.js';
export { ResultInterceptor } from './http/result.interceptor.js';
export { ProblemDetailsException } from './http/problem-details.exception.js';
export { ResultModule } from './http/result.module.js';
export { matchError } from './core/match-error.js';
export type { ErrorHandlers, MissingErrorHandlers, StaleErrorHandlers } from './core/match-error.js';

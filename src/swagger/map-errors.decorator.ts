import { ApiExtraModels, ApiResponse } from '@nestjs/swagger';
import type { FailWhen, FirstFailure } from '../core/checks.js';
import type { UsedDefaultKeys } from '../core/coverage.js';
import type { ErrorBodyFormat, ErrorDefaults } from '../core/error-defaults.js';
import type { AnyErrorMap, ErrorMapCheck } from '../core/error-map.js';
import { errorMappingOf, type ErrorMapping } from '../core/error-mapping.js';
import type { ProblemTypesCheck } from '../core/problem-types.js';
import type { ErrorOfReturn, ResultReturningMethod } from '../core/result-source.js';
import type { FamilyOf } from '../core/tags.js';
import { applyErrorMap } from '../http/apply-error-map.js';
import { errorResponsesOf, type ErrorSchemas } from './error-responses.js';
import { documentImplicitSuccessOnceDecorated } from './implicit-success.js';

export type MissingDefaultUses<K> = { readonly __missingDefaultUses: K };

export type StaleDefaultUses<K> = { readonly __staleDefaultUses: K };

type DefaultUsesCheck<E, M, D, U> = [Exclude<UsedDefaultKeys<E, keyof M, keyof D>, U>] extends [never]
  ? [Exclude<U, UsedDefaultKeys<E, keyof M, keyof D>>] extends [never]
    ? unknown
    : StaleDefaultUses<Exclude<U, UsedDefaultKeys<E, keyof M, keyof D>>>
  : MissingDefaultUses<Exclude<UsedDefaultKeys<E, keyof M, keyof D>, U>>;

type FamilyKeysInUse<E, M, D> = Extract<keyof M | UsedDefaultKeys<E, keyof M, keyof D>, FamilyOf<E>>;

export type MissingFamilyKeys<K> = { readonly __missingFamilyKeys: K };

export type StaleFamilyKeys<K> = { readonly __staleFamilyKeys: K };

type FamiliesCheck<E, M, D, Fam> = FirstFailure<
  [
    FailWhen<Exclude<FamilyKeysInUse<E, M, D>, Fam>, MissingFamilyKeys<Exclude<FamilyKeysInUse<E, M, D>, Fam>>>,
    FailWhen<Exclude<Fam, FamilyKeysInUse<E, M, D>>, StaleFamilyKeys<Exclude<Fam, FamilyKeysInUse<E, M, D>>>>,
  ]
>;

type DocumentationCheck<E, M, D, U, Fam> = FirstFailure<
  [
    DefaultUsesCheck<E, M, D, U>,
    unknown extends ErrorMapCheck<E, M, D> ? FamiliesCheck<E, M, D, Fam> : unknown,
  ]
>;

export type DocumentedErrors<Fam extends string, K extends string> = {
  readonly families?: readonly Fam[];
  readonly schemas?: ErrorSchemas<K>;
};

export type DocumentedDefaults<U extends string, Fam extends string = never, K extends string = U> = {
  readonly uses: readonly U[];
  readonly families?: readonly Fam[];
  readonly schemas?: ErrorSchemas<K>;
};

export type DocumentedMapErrorsDecorator<
  M,
  D,
  U,
  Fam = never,
  P extends ErrorBodyFormat = 'plain',
> = <F extends ResultReturningMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F> &
    FirstFailure<[ProblemTypesCheck<M, P>, ErrorMapCheck<ErrorOfReturn<ReturnType<F>>, M, D>]> &
    (unknown extends ProblemTypesCheck<M, P> ? DocumentationCheck<ErrorOfReturn<ReturnType<F>>, M, D, U, Fam> : unknown),
) => void;

export type DocumentedMapErrorsWithDefaults<D, F extends ErrorBodyFormat = ErrorBodyFormat> = <
  const M extends AnyErrorMap,
  const U extends keyof D & string = never,
  const Fam extends string = never,
>(
  map: M,
  documentation: DocumentedDefaults<U, Fam, NoInfer<(keyof M & string) | U>>,
) => DocumentedMapErrorsDecorator<M, D, U, Fam, F>;

type Decorate = (target: object, key: string | symbol, descriptor: PropertyDescriptor) => void;

function documentedMapErrors<const M extends AnyErrorMap, const Fam extends string = never>(
  map: M,
  documentation: DocumentedErrors<Fam, NoInfer<keyof M & string>> = {},
): DocumentedMapErrorsDecorator<M, {}, never, Fam> {
  return documentWith(errorMappingOf(map), map, documentation);
}

function withDefaults<D extends AnyErrorMap, F extends ErrorBodyFormat = ErrorBodyFormat>(
  defaults: ErrorDefaults<D, F>,
): DocumentedMapErrorsWithDefaults<D, F> {
  return (map, { uses, ...documentation }) =>
    documentWith(errorMappingOf(map, defaults), { ...pickKeys(defaults, uses), ...map }, documentation);
}

function documentWith(
  mapping: ErrorMapping,
  documented: AnyErrorMap,
  documentation: DocumentedErrors<string, string>,
): Decorate {
  const { responses, models } = errorResponsesOf(
    documented,
    documentation.families ?? [],
    documentation.schemas ?? {},
    mapping.bodyFormat,
  );
  return (target, key, descriptor) => {
    applyErrorMap(mapping, target, key, descriptor);
    responses.forEach((response) => ApiResponse({ ...response })(target, key, descriptor));
    if (models.length > 0) ApiExtraModels(...models)(target, key, descriptor);
    documentImplicitSuccessOnceDecorated(target, key);
  };
}

function pickKeys(map: AnyErrorMap, keys: readonly string[]): AnyErrorMap {
  return Object.fromEntries(Object.entries(map).filter(([key]) => keys.includes(key)));
}

export const MapErrors = Object.assign(documentedMapErrors, { withDefaults });

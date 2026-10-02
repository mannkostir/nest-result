import { expectTypeOf } from 'expect-type';
import type { Result, ResultAsync } from 'neverthrow';
import type { AmbiguousErrorKeys, UntaggedErrorsCannotBeMapped } from '../../src/core/checks.js';
import type { AmbiguousKeys, MissingKeys, StaleKeys, UsedDefaultKeys } from '../../src/core/coverage.js';
import type {
  ErrorBodyParameterMismatch,
  ErrorMap,
  ErrorMapCheck,
  MissingErrorMapKeys,
  StaleErrorMapKeys,
} from '../../src/core/error-map.js';
import type { ErrorOfReturn } from '../../src/core/result-source.js';
import type { FamilyOf, MembersWithKey, TagOf, UntaggedMember } from '../../src/core/tags.js';

type NotFound = { readonly _tag: 'NotFound'; readonly id: string };
type Denied = { readonly _tag: 'Denied' };
type Loose = { readonly _tag: string };
type DealMissing = { readonly _tag: 'DealMissing'; readonly _family: 'Missing'; readonly dealId: string };
type TaskMissing = { readonly _tag: 'TaskMissing'; readonly _family: 'Missing' };
type LooseFamily = { readonly _tag: 'LooseFamily'; readonly _family: string };
type Clash = { readonly _tag: 'Missing' };
type Family = DealMissing | TaskMissing | Denied;

expectTypeOf<TagOf<NotFound | Denied>>().toEqualTypeOf<'NotFound' | 'Denied'>();
expectTypeOf<FamilyOf<Family>>().toEqualTypeOf<'Missing'>();
expectTypeOf<UntaggedMember<NotFound | Denied>>().toEqualTypeOf<never>();
expectTypeOf<UntaggedMember<Family>>().toEqualTypeOf<never>();
expectTypeOf<UntaggedMember<NotFound | Error>>().toEqualTypeOf<Error>();
expectTypeOf<UntaggedMember<Loose>>().toEqualTypeOf<Loose>();
expectTypeOf<UntaggedMember<LooseFamily>>().toEqualTypeOf<LooseFamily>();
expectTypeOf<MembersWithKey<Family, 'Missing'>>().toEqualTypeOf<DealMissing | TaskMissing>();
expectTypeOf<MembersWithKey<Family, 'DealMissing'>>().toEqualTypeOf<DealMissing>();
expectTypeOf<AmbiguousKeys<DealMissing | Clash>>().toEqualTypeOf<'Missing'>();
expectTypeOf<MissingKeys<Family, 'Denied'>>().toEqualTypeOf<'Missing'>();
expectTypeOf<MissingKeys<Family, 'Missing'>>().toEqualTypeOf<'Denied'>();
expectTypeOf<MissingKeys<NotFound | Denied, 'NotFound'>>().toEqualTypeOf<'Denied'>();
expectTypeOf<StaleKeys<Family, 'Missing' | 'Denied' | 'Stale'>>().toEqualTypeOf<'Stale'>();
expectTypeOf<StaleKeys<DealMissing, 'Missing' | 'DealMissing'>>().toEqualTypeOf<'Missing'>();
expectTypeOf<UsedDefaultKeys<Family, 'Denied', 'Missing' | 'Conflict'>>().toEqualTypeOf<'Missing'>();
expectTypeOf<UsedDefaultKeys<Family, 'Denied' | 'Missing', 'Missing' | 'Conflict'>>().toEqualTypeOf<never>();

expectTypeOf<{ Missing: 404; Denied: 403 }>().toMatchTypeOf<ErrorMap<Family>>();
expectTypeOf<{ DealMissing: 404; TaskMissing: 404; Denied: 403 }>().toMatchTypeOf<ErrorMap<Family>>();

expectTypeOf<ErrorMapCheck<NotFound | Denied, { NotFound: 404; Denied: 403 }>>().toEqualTypeOf<unknown>();
expectTypeOf<ErrorMapCheck<Family, { Missing: 404; Denied: 403 }>>().toEqualTypeOf<unknown>();
expectTypeOf<ErrorMapCheck<Family, { DealMissing: 410; Missing: 404; Denied: 403 }>>().toEqualTypeOf<unknown>();
expectTypeOf<ErrorMapCheck<Family, { Denied: 403 }, { Missing: 404; Conflict: 409 }>>().toEqualTypeOf<unknown>();
expectTypeOf<ErrorMapCheck<never, {}>>().toEqualTypeOf<unknown>();
expectTypeOf<ErrorMapCheck<NotFound | Denied, { NotFound: 404 }>>().toEqualTypeOf<MissingErrorMapKeys<'Denied'>>();
expectTypeOf<ErrorMapCheck<Family, { Denied: 403 }>>().toEqualTypeOf<MissingErrorMapKeys<'Missing'>>();
expectTypeOf<ErrorMapCheck<NotFound, { NotFound: 404; Stale: 500 }>>().toEqualTypeOf<StaleErrorMapKeys<'Stale'>>();
expectTypeOf<ErrorMapCheck<DealMissing, { DealMissing: 404; Missing: 404 }>>().toEqualTypeOf<
  StaleErrorMapKeys<'Missing'>
>();
expectTypeOf<ErrorMapCheck<NotFound | Error, { NotFound: 404 }>>().toEqualTypeOf<UntaggedErrorsCannotBeMapped<Error>>();
expectTypeOf<ErrorMapCheck<DealMissing | Clash, { Missing: 404 }>>().toEqualTypeOf<AmbiguousErrorKeys<'Missing'>>();
expectTypeOf<
  ErrorMapCheck<Family, { Missing: { status: 404; body: (e: DealMissing) => object }; Denied: 403 }>
>().toEqualTypeOf<ErrorBodyParameterMismatch<'Missing'>>();
expectTypeOf<
  ErrorMapCheck<Family, { Missing: { status: 404; body: (e: DealMissing | TaskMissing) => object }; Denied: 403 }>
>().toEqualTypeOf<unknown>();
expectTypeOf<
  ErrorMapCheck<Family, { Denied: 403 }, { Missing: { status: 404; body: (e: Denied) => object } }>
>().toEqualTypeOf<ErrorBodyParameterMismatch<'Missing'>>();

expectTypeOf<ErrorOfReturn<ResultAsync<number, NotFound>>>().toEqualTypeOf<NotFound>();
expectTypeOf<ErrorOfReturn<Promise<Result<number, Denied>>>>().toEqualTypeOf<Denied>();
expectTypeOf<ErrorOfReturn<Result<number, NotFound | Denied>>>().toEqualTypeOf<NotFound | Denied>();

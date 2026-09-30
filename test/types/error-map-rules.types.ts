import { expectTypeOf } from 'expect-type';
import type { Result, ResultAsync } from 'neverthrow';
import type {
  ErrorMap,
  ErrorMapCheck,
  HttpErrorSpec,
  MissingErrorMapKeys,
  StaleErrorMapKeys,
  UntaggedErrorsCannotBeMapped,
} from '../../src/core/error-map.js';
import type { ErrorOfReturn } from '../../src/core/result-source.js';
import type { TagOf, UntaggedMember } from '../../src/core/tags.js';

type NotFound = { readonly _tag: 'NotFound'; readonly id: string };
type Denied = { readonly _tag: 'Denied' };
type Loose = { readonly _tag: string };

expectTypeOf<TagOf<NotFound | Denied>>().toEqualTypeOf<'NotFound' | 'Denied'>();
expectTypeOf<UntaggedMember<NotFound | Denied>>().toEqualTypeOf<never>();
expectTypeOf<UntaggedMember<NotFound | Error>>().toEqualTypeOf<Error>();
expectTypeOf<UntaggedMember<Loose>>().toEqualTypeOf<Loose>();

expectTypeOf<ErrorMap<NotFound | Denied>>().toEqualTypeOf<{
  readonly NotFound: HttpErrorSpec<NotFound>;
  readonly Denied: HttpErrorSpec<Denied>;
}>();
expectTypeOf<ErrorMap<never>>().toEqualTypeOf<{}>();
expectTypeOf<ErrorMap<NotFound | Error>>().toEqualTypeOf<UntaggedErrorsCannotBeMapped<Error>>();

expectTypeOf<ErrorMapCheck<NotFound | Denied, { NotFound: 404; Denied: 403 }>>().toEqualTypeOf<unknown>();
expectTypeOf<ErrorMapCheck<NotFound | Denied, { NotFound: 404 }>>().toEqualTypeOf<MissingErrorMapKeys<'Denied'>>();
expectTypeOf<ErrorMapCheck<NotFound, { NotFound: 404; Stale: 500 }>>().toEqualTypeOf<StaleErrorMapKeys<'Stale'>>();
expectTypeOf<ErrorMapCheck<NotFound | Error, { NotFound: 404 }>>().toEqualTypeOf<UntaggedErrorsCannotBeMapped<Error>>();

expectTypeOf<ErrorOfReturn<ResultAsync<number, NotFound>>>().toEqualTypeOf<NotFound>();
expectTypeOf<ErrorOfReturn<Promise<Result<number, Denied>>>>().toEqualTypeOf<Denied>();
expectTypeOf<ErrorOfReturn<Result<number, NotFound | Denied>>>().toEqualTypeOf<NotFound | Denied>();

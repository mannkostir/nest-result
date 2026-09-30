# nest-result v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and package `nest-result` 0.1: tagged errors, compiler-checked exhaustive mapping of neverthrow Results to HTTP for NestJS, Swagger output, and transactions that roll back on `Err`.

**Architecture:** A pure `src/core` (no Nest imports) holds tagged errors, the type-level error-map rules and error resolution. `src/http` adapts the core to Nest (`toHttp`, `MapErrors`, `ResultInterceptor`, `ResultModule`). `src/swagger` and `src/transactional` are separate entry points so their optional peers are only needed when imported. Dependencies point inward to `core` only.

**Tech Stack:** TypeScript 6.0 (dev), neverthrow 8, NestJS 12 (11 supported), nestjs-cls 7 + @nestjs-cls/transactional 4, vitest 5 + unplugin-swc, tsup 8, publint, @arethetypeswrong/cli, TypeORM 1 + better-sqlite3 12 (tests only). Releases go through a GitHub Release and npm trusted publishing, as in the author's `nestjs-kafka`.

**Spec:** `docs/superpowers/specs/2026-09-30-nest-result-design.md`

**Project rules:** `CLAUDE.md` at the repo root. It applies to every task and wins over this plan wherever they differ.

**Validation note:** Every source file and every test in this plan was compiled and run in a throwaway prototype before the plan was written: 58 tests green, type tests green on TypeScript 5.5.4, 6.0.3 and 7.0.2, dual build clean under publint and attw. Deviations from the code below should be treated as suspect.

## Global Constraints

- Work on branch `initial-release`, which already exists. Never push, publish, tag, or create remote repositories or Releases; those are the author's decisions.
- Zero comments in any file: no `//`, `/* */` or `/** */`, in source or tests. The only permitted exception is the `// @ts-expect-error` directive in type-test and fixture files.
- ESM package (`"type": "module"`); relative imports use `.js` extensions (`moduleResolution: nodenext`).
- Node `>=22.12.0` (the CommonJS entry points load the ESM build through `require(esm)`). Consumers need TypeScript `>=5.5`. The repo builds with TypeScript `~6.0.3`, because TypeScript 7 has no JavaScript compiler API and tsup's declaration build and attw need it.
- Peer ranges: `neverthrow ^8.0.0`, `@nestjs/common` and `@nestjs/core` `^11.0.0 || ^12.0.0`, `rxjs ^7.1.0`, `reflect-metadata ^0.1.12 || ^0.2.0`; optional peers `@nestjs/swagger ^11.0.0 || ^12.0.0`, `nestjs-cls ^7.0.0`, `@nestjs-cls/transactional ^4.0.0`.
- Library classes that Nest instantiates must use explicit `@Inject(...)` on constructor parameters, because tsup (esbuild) does not emit decorator metadata.
- Commit messages are a subject line only: lowercase, imperative, 2-6 words, no conventional-commit prefix, no trailing period, no body, no `Co-Authored-By` or other trailer. Use exactly the subject given in each task's commit step.
- `dist` holds exactly one implementation: ESM `.js` files. Each `.cjs` entry point is a one-line wrapper that `require`s the matching `.js` file. Never ship a second CommonJS implementation.
- Test style: Arrange-Act-Assert, one claim per test, no conditionals or loops in test bodies.

## Review Focus

1. A global `ClassSerializerInterceptor` registered alongside `MapErrors` routes: the Result must be converted before the serializer runs, so the response is the serialized Ok value, not `{ value: ... }`. Test owned by Task 5.
2. A `TaggedError` payload that smuggles `_tag` or `name` in through a cast must not overwrite the tag or name. Test owned by Task 1.
3. An error whose `_tag` equals an `Object.prototype` key (`toString`, `constructor`) must not resolve through the prototype chain. Test owned by Task 3.
4. A command endpoint returning `Ok(undefined)` from a `POST` must respond with the route's default 201 and an empty body. Test owned by Task 5.
5. `@TransactionalResult` stacked on top of `@MapErrors` on one controller method must keep the mapping working, and concurrent transactions must stay isolated. Tests owned by Tasks 9 and 8.

---

### Task 1: Project scaffold and TaggedError

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`
- Create: `src/core/tagged-error.ts`, `src/index.ts`
- Test: `test/core/tagged-error.test.ts`, `test/types/tagged-error.types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TaggedError<const Tag extends string>(tag: Tag): TaggedErrorClass<Tag>`; types `TaggedErrorPayload`, `TaggedErrorInstance<Tag, P>`, `TaggedErrorClass<Tag>`. Subclass usage: `class X extends TaggedError('X')<{ field: string }> {}`.

- [ ] **Step 1: Confirm the branch**

```bash
cd /Users/mannkostir/Documents/nodejs-result
git branch --show-current
```

Expected: `initial-release`.

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "nest-result",
  "version": "0.0.0",
  "description": "Compiler-checked, exhaustive mapping of neverthrow Results to HTTP responses for NestJS, plus transactions that roll back on Err.",
  "keywords": ["nestjs", "neverthrow", "result", "typed-errors", "error-handling", "transactions"],
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "engines": {
    "node": ">=22.12.0"
  },
  "files": ["dist"],
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@nestjs-cls/transactional": "^4.0.0",
    "@nestjs/common": "^11.0.0 || ^12.0.0",
    "@nestjs/core": "^11.0.0 || ^12.0.0",
    "@nestjs/swagger": "^11.0.0 || ^12.0.0",
    "nestjs-cls": "^7.0.0",
    "neverthrow": "^8.0.0",
    "reflect-metadata": "^0.1.12 || ^0.2.0",
    "rxjs": "^7.1.0"
  },
  "peerDependenciesMeta": {
    "@nestjs-cls/transactional": { "optional": true },
    "@nestjs/swagger": { "optional": true },
    "nestjs-cls": { "optional": true }
  }
}
```

- [ ] **Step 3: Install the first dev dependencies and approve the swc install script**

```bash
npm install -D typescript@~6.0.3 vitest@^5.0.3 unplugin-swc@^2.0.0 @swc/core@^1.16.13 expect-type@^1.4.0 @types/node@^22 neverthrow@^8.2.0 reflect-metadata@^0.2.2 rxjs@^7.8.2
npm install-scripts approve @swc/core
```

Expected: install succeeds; `package.json` gains `devDependencies` and an `allowScripts` entry for `@swc/core`.

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"],
  "exclude": ["test/diagnostics/fixtures"]
}
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.snapshot.test.ts', 'node_modules/**'],
    testTimeout: 20_000,
  },
});
```

- [ ] **Step 6: Write `.gitignore` and `LICENSE`**

`.gitignore`:

```
node_modules/
dist/
*.tgz
coverage/
examples/*/node_modules/
examples/*/dist/
.ts-matrix/
.claude/
.mcp.json
```

`LICENSE`:

```
MIT License

Copyright (c) 2026 mannkostir

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Write the failing runtime tests** in `test/core/tagged-error.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { TaggedError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}

class Unauthorized extends TaggedError('Unauthorized') {}

class Explained extends TaggedError('Explained')<{ message: string }> {}

describe('TaggedError', () => {
  it('exposes its tag', () => {
    expect(new DealNotFound({ dealId: '42' })._tag).toBe('DealNotFound');
  });

  it('exposes payload fields on the instance', () => {
    expect(new DealNotFound({ dealId: '42' }).dealId).toBe('42');
  });

  it('is an Error', () => {
    expect(new Unauthorized()).toBeInstanceOf(Error);
  });

  it('is an instance of its own subclass', () => {
    expect(new Unauthorized()).toBeInstanceOf(Unauthorized);
  });

  it('uses the tag as its name', () => {
    expect(new Unauthorized().name).toBe('Unauthorized');
  });

  it('uses the tag as its default message', () => {
    expect(new Unauthorized().message).toBe('Unauthorized');
  });

  it('uses the payload message when one is given', () => {
    expect(new Explained({ message: 'Token expired' }).message).toBe('Token expired');
  });

  it('captures a stack trace', () => {
    expect(new Unauthorized().stack).toContain('Unauthorized');
  });

  it('keeps its tag when a payload smuggles in a _tag through a cast', () => {
    const forged = new DealNotFound({ dealId: '1', _tag: 'Forged' } as unknown as { dealId: string });
    expect(forged._tag).toBe('DealNotFound');
  });

  it('keeps its name when a payload smuggles in a name through a cast', () => {
    const forged = new DealNotFound({ dealId: '1', name: 'Forged' } as unknown as { dealId: string });
    expect(forged.name).toBe('DealNotFound');
  });
});
```

- [ ] **Step 8: Write the type tests** in `test/types/tagged-error.types.ts`

```ts
import { expectTypeOf } from 'expect-type';
import { TaggedError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class Unauthorized extends TaggedError('Unauthorized') {}
interface OrderPayload {
  readonly orderId: string;
}
class OrderMissing extends TaggedError('OrderMissing')<OrderPayload> {}

expectTypeOf(new DealNotFound({ dealId: '1' })._tag).toEqualTypeOf<'DealNotFound'>();
expectTypeOf(new DealNotFound({ dealId: '1' }).dealId).toEqualTypeOf<string>();
expectTypeOf(new OrderMissing({ orderId: '1' }).orderId).toEqualTypeOf<string>();
expectTypeOf(new Unauthorized()).toMatchTypeOf<Error>();

// @ts-expect-error
new DealNotFound();

// @ts-expect-error
new DealNotFound({ dealId: 1 });

// @ts-expect-error
export class ReservedTag extends TaggedError('ReservedTag')<{ _tag: 'Other' }> {}

// @ts-expect-error
export class ReservedName extends TaggedError('ReservedName')<{ name: string }> {}

// @ts-expect-error
export class NumericMessage extends TaggedError('NumericMessage')<{ message: number }> {}

const tagged = new Unauthorized();
// @ts-expect-error
tagged._tag = 'Other';
```

- [ ] **Step 9: Run both to verify they fail**

Run: `npx vitest run test/core/tagged-error.test.ts && npm run typecheck`
Expected: FAIL, cannot resolve `../../src/index.js`.

- [ ] **Step 10: Implement** `src/core/tagged-error.ts`

```ts
export type TaggedErrorPayload = object & {
  readonly message?: string;
  readonly _tag?: never;
  readonly name?: never;
};

type ConstructorArgs<P> = {} extends P ? [payload?: P] : [payload: P];

export type TaggedErrorInstance<Tag extends string, P> = Error & {
  readonly _tag: Tag;
} & Readonly<Omit<P, 'message'>>;

export type TaggedErrorClass<Tag extends string> = new <P extends TaggedErrorPayload = {}>(
  ...args: ConstructorArgs<P>
) => TaggedErrorInstance<Tag, P>;

export function TaggedError<const Tag extends string>(tag: Tag): TaggedErrorClass<Tag> {
  class TaggedErrorBase extends Error {
    readonly _tag: Tag;

    constructor(payload?: TaggedErrorPayload) {
      super(payload?.message ?? tag);
      Object.assign(this, payload);
      this._tag = tag;
      this.name = tag;
    }
  }
  return TaggedErrorBase as TaggedErrorClass<Tag>;
}
```

`src/index.ts`:

```ts
export { TaggedError } from './core/tagged-error.js';
export type { TaggedErrorClass, TaggedErrorInstance, TaggedErrorPayload } from './core/tagged-error.js';
```

- [ ] **Step 11: Run to verify they pass**

Run: `npx vitest run test/core/tagged-error.test.ts && npm run typecheck`
Expected: 10 tests PASS; typecheck exits 0 with no output.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore LICENSE src test
git commit -m "scaffold package with tagged errors"
```

---

### Task 2: Error-map types

**Files:**
- Create: `src/core/tags.ts`, `src/core/error-map.ts`, `src/core/result-source.ts`
- Modify: `src/index.ts`
- Test: `test/types/error-map-rules.types.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at the type level.
- Produces:
  - `Tagged`, `TagOf<E>`, `UntaggedMember<E>` in `src/core/tags.ts`.
  - `HttpErrorSpec<E>`, `AnyHttpErrorSpec`, `AnyErrorMap`, `ErrorMap<E>`, `ExactErrorMap<E, M>`, `ErrorMapCheck<E, M>`, and the marker types `UntaggedErrorsCannotBeMapped<U>`, `MissingErrorMapKeys<K>`, `StaleErrorMapKeys<K>`, `ErrorBodyParameterMismatch<M>` in `src/core/error-map.ts`.
  - `ResultSource<T, E>`, `ResultReturningMethod`, `ErrorOfReturn<R>` in `src/core/result-source.ts`.

- [ ] **Step 1: Write the failing type tests** in `test/types/error-map-rules.types.ts`

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run typecheck`
Expected: FAIL, cannot find modules `../../src/core/error-map.js`, `result-source.js`, `tags.js`.

- [ ] **Step 3: Implement** `src/core/tags.ts`

```ts
export type Tagged = { readonly _tag: string };

export type TagOf<E> = E extends { readonly _tag: infer T extends string } ? T : never;

export type UntaggedMember<E> = E extends { readonly _tag: infer T }
  ? T extends string
    ? string extends T
      ? E
      : never
    : E
  : E;
```

`src/core/error-map.ts`:

```ts
import type { TagOf, UntaggedMember } from './tags.js';

export type HttpErrorSpec<E> =
  | number
  | { readonly status: number; readonly body: (error: E) => object };

export type AnyHttpErrorSpec =
  | number
  | { readonly status: number; readonly body: (error: never) => object };

export type AnyErrorMap = { readonly [tag: string]: AnyHttpErrorSpec };

export type UntaggedErrorsCannotBeMapped<U> = { readonly __untaggedErrorsCannotBeMapped: U };

export type MissingErrorMapKeys<K> = { readonly __missingErrorMapKeys: K };

export type StaleErrorMapKeys<K> = { readonly __staleErrorMapKeys: K };

export type ErrorBodyParameterMismatch<M> = { readonly __errorBodyParameterMismatch: M };

export type ErrorMap<E> = [UntaggedMember<E>] extends [never]
  ? { readonly [K in TagOf<E>]: HttpErrorSpec<Extract<E, { readonly _tag: K }>> }
  : UntaggedErrorsCannotBeMapped<UntaggedMember<E>>;

type StaleKeys<E, M> = Exclude<keyof M, TagOf<E>>;

type MissingKeys<E, M> = Exclude<TagOf<E>, keyof M>;

export type ExactErrorMap<E, M> = M &
  ([StaleKeys<E, M>] extends [never] ? unknown : StaleErrorMapKeys<StaleKeys<E, M>>);

export type ErrorMapCheck<E, M> = [UntaggedMember<E>] extends [never]
  ? [MissingKeys<E, M>] extends [never]
    ? [StaleKeys<E, M>] extends [never]
      ? M extends ErrorMap<E>
        ? unknown
        : ErrorBodyParameterMismatch<M>
      : StaleErrorMapKeys<StaleKeys<E, M>>
    : MissingErrorMapKeys<MissingKeys<E, M>>
  : UntaggedErrorsCannotBeMapped<UntaggedMember<E>>;
```

`src/core/result-source.ts`:

```ts
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
```

Replace `src/index.ts` with:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run typecheck && npx -y -p typescript@5.5.4 tsc -p tsconfig.json && npx -y -p typescript@7.0.2 tsc -p tsconfig.json`
Expected: all three exit 0 with no output.

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "add error map types"
```

---

### Task 3: Library errors and resolveHttpError

**Files:**
- Create: `src/core/library-errors.ts`, `src/core/resolve-http-error.ts`
- Modify: `src/index.ts`
- Test: `test/core/resolve-http-error.test.ts`

**Interfaces:**
- Consumes: `TaggedError` (Task 1); `AnyErrorMap`, `AnyHttpErrorSpec` (Task 2).
- Produces:
  - `UnmappedErrorTagError.forTag(tag: string)`, `UntaggedErrorValueError.forValue(value: unknown)`, `MissingErrorMapError.forHandler(handler: string)`, `DuplicateNeverthrowError.forHandler(handler: string)`.
  - `resolveHttpError(error: unknown, map: AnyErrorMap): Result<HttpErrorResponse, UnmappedErrorTagError | UntaggedErrorValueError>`
  - `statusOf(spec: AnyHttpErrorSpec): number`
  - `type HttpErrorResponse = { readonly status: number; readonly body: object }`

- [ ] **Step 1: Write the failing tests** in `test/core/resolve-http-error.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { resolveHttpError, statusOf } from '../../src/core/resolve-http-error.js';
import { TaggedError, UnmappedErrorTagError, UntaggedErrorValueError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

describe('resolveHttpError', () => {
  it('resolves a numeric spec to its status', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: '1', message: 'Deal not found' }), { DealNotFound: 404 });
    expect(resolved._unsafeUnwrap().status).toBe(404);
  });

  it('builds the default body from status, tag and message', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: '1', message: 'Deal not found' }), { DealNotFound: 404 });
    expect(resolved._unsafeUnwrap().body).toEqual({ statusCode: 404, code: 'DealNotFound', message: 'Deal not found' });
  });

  it('leaves payload fields out of the default body', () => {
    const resolved = resolveHttpError(new DealNotFound({ dealId: 'secret', message: 'm' }), { DealNotFound: 404 });
    expect(resolved._unsafeUnwrap().body).not.toHaveProperty('dealId');
  });

  it('uses the tag as message for a plain tagged object', () => {
    const resolved = resolveHttpError({ _tag: 'RateLimited' }, { RateLimited: 429 });
    expect(resolved._unsafeUnwrap().body).toEqual({ statusCode: 429, code: 'RateLimited', message: 'RateLimited' });
  });

  it('uses a custom body function as the whole body', () => {
    const map = { DealNotFound: { status: 404, body: (e: DealNotFound) => ({ missing: e.dealId }) } };
    const resolved = resolveHttpError(new DealNotFound({ dealId: '7', message: 'm' }), map);
    expect(resolved._unsafeUnwrap()).toEqual({ status: 404, body: { missing: '7' } });
  });

  it('fails with UnmappedErrorTagError for a tag missing from the map', () => {
    const resolved = resolveHttpError({ _tag: 'Unknown' }, { DealNotFound: 404 });
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UnmappedErrorTagError);
  });

  it('does not resolve tags that only exist on Object.prototype', () => {
    const resolved = resolveHttpError({ _tag: 'toString' }, { DealNotFound: 404 });
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UnmappedErrorTagError);
  });

  it('fails with UntaggedErrorValueError for a plain Error', () => {
    const resolved = resolveHttpError(new Error('plain'), { DealNotFound: 404 });
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UntaggedErrorValueError);
  });

  it('fails with UntaggedErrorValueError for a non-object', () => {
    const resolved = resolveHttpError('DealNotFound', { DealNotFound: 404 });
    expect(resolved._unsafeUnwrapErr()).toBeInstanceOf(UntaggedErrorValueError);
  });
});

describe('statusOf', () => {
  it('reads the status of a numeric spec', () => {
    expect(statusOf(418)).toBe(418);
  });

  it('reads the status of an object spec', () => {
    expect(statusOf({ status: 409, body: () => ({}) })).toBe(409);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/core/resolve-http-error.test.ts`
Expected: FAIL, cannot resolve `../../src/core/resolve-http-error.js`.

- [ ] **Step 3: Implement** `src/core/library-errors.ts`

```ts
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
```

`src/core/resolve-http-error.ts`:

```ts
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
```

Append to `src/index.ts`:

```ts
export {
  DuplicateNeverthrowError,
  MissingErrorMapError,
  UnmappedErrorTagError,
  UntaggedErrorValueError,
} from './core/library-errors.js';
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/core && npm run typecheck`
Expected: 21 tests PASS (10 from Task 1, 11 new); typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src test
git commit -m "resolve tagged errors to http"
```

---

### Task 4: toHttp

**Files:**
- Create: `src/http/exception-for.ts`, `src/http/to-http.ts`
- Modify: `src/index.ts`
- Test: `test/http/to-http.test.ts`, `test/types/to-http.types.ts`

**Interfaces:**
- Consumes: `resolveHttpError` (Task 3); `AnyErrorMap`, `ErrorMap`, `ExactErrorMap`, `ResultSource` (Task 2).
- Produces:
  - `exceptionFor(error: unknown, map: AnyErrorMap): HttpException | UnmappedErrorTagError | UntaggedErrorValueError`
  - `toHttp<T, E, const M extends ErrorMap<E>>(source: ResultSource<T, E>, map: ExactErrorMap<E, M>): Promise<T>`

- [ ] **Step 1: Install the Nest peers for development**

```bash
npm install -D @nestjs/common@^12.1.2 @nestjs/core@^12.1.2
```

- [ ] **Step 2: Write the failing runtime tests** in `test/http/to-http.test.ts`

```ts
import { HttpException } from '@nestjs/common';
import { err, errAsync, ok, okAsync, type Result } from 'neverthrow';
import { describe, expect, it } from 'vitest';
import { TaggedError, toHttp, UnmappedErrorTagError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

const notFound = () => new DealNotFound({ dealId: '9', message: 'Deal not found' });

async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return pending.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
}

describe('toHttp', () => {
  it('resolves to the Ok value of a Result', async () => {
    await expect(toHttp(ok(1), {})).resolves.toBe(1);
  });

  it('resolves to the Ok value of a ResultAsync', async () => {
    await expect(toHttp(okAsync('a'), {})).resolves.toBe('a');
  });

  it('resolves to the Ok value of a Promise of a Result', async () => {
    const promised: Promise<Result<number, DealNotFound>> = Promise.resolve(ok(3));
    await expect(toHttp(promised, { DealNotFound: 404 })).resolves.toBe(3);
  });

  it('rejects with an HttpException carrying the mapped status', async () => {
    const thrown = await rejectionOf(toHttp(errAsync(notFound()), { DealNotFound: 404 }));
    expect((thrown as HttpException).getStatus()).toBe(404);
  });

  it('rejects with an HttpException carrying the default body', async () => {
    const thrown = await rejectionOf(toHttp(err(notFound()), { DealNotFound: 404 }));
    expect((thrown as HttpException).getResponse()).toEqual({
      statusCode: 404,
      code: 'DealNotFound',
      message: 'Deal not found',
    });
  });

  it('attaches the original error as the cause', async () => {
    const original = notFound();
    const thrown = await rejectionOf(toHttp(err(original), { DealNotFound: 404 }));
    expect((thrown as HttpException).cause).toBe(original);
  });

  it('rejects with UnmappedErrorTagError when a cast hides an unmapped tag', async () => {
    const forged = err({ _tag: 'Forged' }) as unknown as Result<number, DealNotFound>;
    await expect(toHttp(forged, { DealNotFound: 404 })).rejects.toBeInstanceOf(UnmappedErrorTagError);
  });

  it('rejects with an HttpException instance', async () => {
    await expect(toHttp(err(notFound()), { DealNotFound: 404 })).rejects.toBeInstanceOf(HttpException);
  });
});
```

- [ ] **Step 3: Write the type tests** in `test/types/to-http.types.ts`

```ts
import { expectTypeOf } from 'expect-type';
import type { Result, ResultAsync } from 'neverthrow';
import { TaggedError, toHttp } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class AccessDenied extends TaggedError('AccessDenied') {}

declare const both: ResultAsync<{ id: string }, DealNotFound | AccessDenied>;
declare const syncBoth: Result<{ id: string }, DealNotFound | AccessDenied>;
declare const promised: Promise<Result<{ id: string }, DealNotFound | AccessDenied>>;
declare const untagged: Result<number, DealNotFound | Error>;
declare const infallible: Result<number, never>;
declare const plainTagged: Result<number, { readonly _tag: 'RateLimited' }>;

expectTypeOf(toHttp(both, { DealNotFound: 404, AccessDenied: 403 })).toEqualTypeOf<Promise<{ id: string }>>();
expectTypeOf(toHttp(syncBoth, { DealNotFound: 404, AccessDenied: 403 })).toEqualTypeOf<Promise<{ id: string }>>();
expectTypeOf(toHttp(promised, { DealNotFound: 404, AccessDenied: 403 })).toEqualTypeOf<Promise<{ id: string }>>();
expectTypeOf(toHttp(infallible, {})).toEqualTypeOf<Promise<number>>();
expectTypeOf(toHttp(plainTagged, { RateLimited: 429 })).toEqualTypeOf<Promise<number>>();

toHttp(both, {
  DealNotFound: { status: 404, body: (error) => ({ id: error.dealId }) },
  AccessDenied: 403,
});

// @ts-expect-error
toHttp(both, { DealNotFound: 404 });

// @ts-expect-error
toHttp(both, { DealNotFound: 404, AccessDenied: 403, Stale: 500 });

// @ts-expect-error
toHttp(untagged, { DealNotFound: 404 });

const staleMap = { DealNotFound: 404, AccessDenied: 403, Stale: 500 } as const;
// @ts-expect-error
toHttp(both, staleMap);
```

- [ ] **Step 4: Run to verify they fail**

Run: `npx vitest run test/http/to-http.test.ts; npm run typecheck`
Expected: FAIL, `toHttp` is not exported from `../../src/index.js`.

- [ ] **Step 5: Implement** `src/http/exception-for.ts`

```ts
import { HttpException } from '@nestjs/common';
import type { AnyErrorMap } from '../core/error-map.js';
import type { UnmappedErrorTagError, UntaggedErrorValueError } from '../core/library-errors.js';
import { resolveHttpError } from '../core/resolve-http-error.js';

export function exceptionFor(
  error: unknown,
  map: AnyErrorMap,
): HttpException | UnmappedErrorTagError | UntaggedErrorValueError {
  return resolveHttpError(error, map).match(
    ({ status, body }) => new HttpException(body, status, { cause: error }),
    (libraryError) => libraryError,
  );
}
```

`src/http/to-http.ts`:

```ts
import type { AnyErrorMap, ErrorMap, ExactErrorMap } from '../core/error-map.js';
import type { ResultSource } from '../core/result-source.js';
import { exceptionFor } from './exception-for.js';

export async function toHttp<T, E, const M extends ErrorMap<E>>(
  source: ResultSource<T, E>,
  map: ExactErrorMap<E, M>,
): Promise<T> {
  const result = await source;
  if (result.isErr()) throw exceptionFor(result.error, map as AnyErrorMap);
  return result.value;
}
```

Append to `src/index.ts`:

```ts
export { toHttp } from './http/to-http.js';
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run test/http/to-http.test.ts && npm run typecheck`
Expected: 8 tests PASS; typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src test
git commit -m "map results to http"
```

---

### Task 5: MapErrors, ResultInterceptor and ResultModule

**Files:**
- Create: `src/core/result-detection.ts`, `src/http/error-map-metadata.ts`, `src/http/result.interceptor.ts`, `src/http/apply-error-map.ts`, `src/http/map-errors.decorator.ts`, `src/http/result.module.ts`
- Modify: `src/index.ts`
- Create test support: `test/support/create-app.ts`, `test/support/errors.ts`
- Test: `test/http/map-errors.test.ts`, `test/types/map-errors.types.ts`

**Interfaces:**
- Consumes: `exceptionFor` (Task 4); `MissingErrorMapError`, `DuplicateNeverthrowError` (Task 3); `AnyErrorMap`, `ErrorMapCheck`, `ErrorOfReturn`, `ResultReturningMethod` (Task 2).
- Produces:
  - `isResult(value: unknown): value is Result<unknown, unknown>`, `isResultAsync(value: unknown)`, `looksLikeForeignResult(value: unknown): boolean`
  - `ERROR_MAP_METADATA = 'nest-result:error-map'`
  - `applyErrorMap(map: AnyErrorMap, target: object, key: string | symbol, descriptor: PropertyDescriptor): void` (used again by Task 7)
  - `type MapErrorsDecorator<M>`; `MapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M>`
  - `ResultInterceptor` (injectable), `ResultModule.forRoot(): DynamicModule`
  - Test helpers `createApp(platform: Platform, metadata: ModuleMetadata): Promise<INestApplication>`, `platforms`, and errors `DealNotFound`, `AccessDenied`, `Unavailable` in `test/support/errors.ts`.

- [ ] **Step 1: Install the HTTP test dependencies**

```bash
npm install -D @nestjs/testing@^12.1.2 @nestjs/platform-express@^12.1.2 @nestjs/platform-fastify@^12.1.2 class-transformer@^0.5.1 class-validator@^0.15.1 supertest@^7.3.0 @types/supertest@^7.2.1
```

- [ ] **Step 2: Write the test support files**

`test/support/create-app.ts`:

```ts
import 'reflect-metadata';
import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

export type Platform = 'express' | 'fastify';

export const platforms: readonly Platform[] = ['express', 'fastify'];

export async function createApp(platform: Platform, metadata: ModuleMetadata): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule(metadata).compile();
  if (platform === 'express') return initialised(moduleRef.createNestApplication());
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await initialised(app);
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function initialised<A extends INestApplication>(app: A): Promise<A> {
  await app.init();
  return app;
}
```

`test/support/errors.ts`:

```ts
import { TaggedError } from '../../src/index.js';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

export class AccessDenied extends TaggedError('AccessDenied') {}

export class Unavailable extends TaggedError('Unavailable') {}
```

- [ ] **Step 3: Write the failing integration tests** in `test/http/map-errors.test.ts`

```ts
import { ClassSerializerInterceptor, Controller, Get, type INestApplication, Param, Post } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Exclude } from 'class-transformer';
import { err, errAsync, ok, okAsync, type Result, type ResultAsync } from 'neverthrow';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { MapErrors, ResultModule } from '../../src/index.js';
import { createApp, platforms } from '../support/create-app.js';
import { AccessDenied, DealNotFound } from '../support/errors.js';

class DealView {
  constructor(
    readonly id: string,
    secret: string,
  ) {
    this.secret = secret;
  }

  @Exclude()
  readonly secret: string;
}

@Controller('deals')
class DealsController {
  @Get('async/:id')
  @MapErrors({ DealNotFound: 404, AccessDenied: 403 })
  findAsync(@Param('id') id: string): ResultAsync<DealView, DealNotFound | AccessDenied> {
    if (id === 'missing') return errAsync(new DealNotFound({ dealId: id, message: 'Deal not found' }));
    if (id === 'forbidden') return errAsync(new AccessDenied());
    return okAsync(new DealView(id, 'hidden'));
  }

  @Get('sync/:id')
  @MapErrors({ DealNotFound: { status: 404, body: (e: DealNotFound) => ({ missing: e.dealId }) } })
  findSync(@Param('id') id: string): Result<{ id: string }, DealNotFound> {
    return id === 'missing' ? err(new DealNotFound({ dealId: id, message: 'gone' })) : ok({ id });
  }

  @Post('void')
  @MapErrors({ AccessDenied: 403 })
  async act(): Promise<Result<void, AccessDenied>> {
    return ok(undefined);
  }

  @Get('unmapped')
  unmapped(): Result<number, AccessDenied> {
    return ok(1);
  }

  @Get('plain')
  plain(): { plain: true } {
    return { plain: true };
  }
}

@Controller('foreign')
class ForeignResultController {
  @Get()
  foreign(): object {
    return { isOk: () => true, isErr: () => false, value: 1 };
  }
}

describe.each(platforms)('MapErrors on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, {
      imports: [ResultModule.forRoot()],
      controllers: [DealsController],
      providers: [{ provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor }],
    });
    return request(app.getHttpServer());
  };

  it('serializes the Ok value of a ResultAsync through the global serializer', async () => {
    const response = await (await start()).get('/deals/async/7');
    expect({ status: response.status, body: response.body }).toEqual({ status: 200, body: { id: '7' } });
  });

  it('maps an Err to its status with the default body', async () => {
    const response = await (await start()).get('/deals/async/missing');
    expect({ status: response.status, body: response.body }).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'DealNotFound', message: 'Deal not found' },
    });
  });

  it('falls back to the tag as message for a payload-less error', async () => {
    const response = await (await start()).get('/deals/async/forbidden');
    expect(response.body).toEqual({ statusCode: 403, code: 'AccessDenied', message: 'AccessDenied' });
  });

  it('uses a custom body function', async () => {
    const response = await (await start()).get('/deals/sync/missing');
    expect({ status: response.status, body: response.body }).toEqual({ status: 404, body: { missing: 'missing' } });
  });

  it('responds with the route default status and no body for Ok(undefined)', async () => {
    const response = await (await start()).post('/deals/void');
    expect({ status: response.status, text: response.text }).toEqual({ status: 201, text: '' });
  });

  it('fails with 500 when a Result is returned without MapErrors', async () => {
    const response = await (await start()).get('/deals/unmapped');
    expect(response.status).toBe(500);
  });

  it('passes non-Result values through untouched', async () => {
    const response = await (await start()).get('/deals/plain');
    expect(response.body).toEqual({ plain: true });
  });
});

describe('ResultModule safety net', () => {
  it('fails with 500 when a Result from another neverthrow copy reaches it', async () => {
    const app = await createApp('express', { imports: [ResultModule.forRoot()], controllers: [ForeignResultController] });
    const response = await request(app.getHttpServer()).get('/foreign');
    await app.close();
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 4: Write the decorator type tests** in `test/types/map-errors.types.ts`

```ts
import type { Result, ResultAsync } from 'neverthrow';
import { MapErrors, TaggedError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class AccessDenied extends TaggedError('AccessDenied') {}

declare const both: ResultAsync<{ id: string }, DealNotFound | AccessDenied>;
declare const promised: Promise<Result<{ id: string }, DealNotFound | AccessDenied>>;
declare const untagged: Result<number, DealNotFound | Error>;

export class TypedController {
  @MapErrors({ DealNotFound: 404, AccessDenied: 403 })
  asyncResult(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  @MapErrors({ DealNotFound: 404, AccessDenied: 403 })
  async promisedResult(): Promise<Result<{ id: string }, DealNotFound | AccessDenied>> {
    return promised;
  }

  @MapErrors({ DealNotFound: { status: 404, body: (error: DealNotFound) => ({ id: error.dealId }) }, AccessDenied: 403 })
  annotatedBody(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404 })
  missingKey(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404, AccessDenied: 403, Stale: 500 })
  staleKey(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404 })
  untaggedError(): Result<number, DealNotFound | Error> {
    return untagged;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: 404 })
  notAResult(): number {
    return 1;
  }

  // @ts-expect-error
  @MapErrors({ DealNotFound: { status: 404, body: (error: AccessDenied) => ({ tag: error._tag }) }, AccessDenied: 403 })
  mismatchedBody(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return both;
  }
}
```

- [ ] **Step 5: Run to verify they fail**

Run: `npx vitest run test/http/map-errors.test.ts; npm run typecheck`
Expected: FAIL, `MapErrors` and `ResultModule` are not exported from `../../src/index.js`.

- [ ] **Step 6: Implement** `src/core/result-detection.ts`

```ts
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
```

`src/http/error-map-metadata.ts`:

```ts
export const ERROR_MAP_METADATA = 'nest-result:error-map';
```

`src/http/result.interceptor.ts`:

```ts
import { type CallHandler, type ExecutionContext, Inject, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, mergeMap, type Observable } from 'rxjs';
import type { AnyErrorMap } from '../core/error-map.js';
import { DuplicateNeverthrowError, MissingErrorMapError } from '../core/library-errors.js';
import { isResult, isResultAsync, looksLikeForeignResult } from '../core/result-detection.js';
import { ERROR_MAP_METADATA } from './error-map-metadata.js';
import { exceptionFor } from './exception-for.js';

@Injectable()
export class ResultInterceptor implements NestInterceptor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const map = this.reflector.get<AnyErrorMap | undefined>(ERROR_MAP_METADATA, context.getHandler());
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    return next.handle().pipe(mergeMap((value: unknown) => from(unwrapResponse(value, map, handler))));
  }
}

async function unwrapResponse(value: unknown, map: AnyErrorMap | undefined, handler: string): Promise<unknown> {
  const settled = isResultAsync(value) ? await value : value;
  if (!isResult(settled)) return passThrough(settled, handler);
  if (map === undefined) throw MissingErrorMapError.forHandler(handler);
  if (settled.isErr()) throw exceptionFor(settled.error, map);
  return settled.value;
}

function passThrough(value: unknown, handler: string): unknown {
  if (looksLikeForeignResult(value)) throw DuplicateNeverthrowError.forHandler(handler);
  return value;
}
```

`src/http/apply-error-map.ts`:

```ts
import { SetMetadata, UseInterceptors } from '@nestjs/common';
import type { AnyErrorMap } from '../core/error-map.js';
import { ERROR_MAP_METADATA } from './error-map-metadata.js';
import { ResultInterceptor } from './result.interceptor.js';

export function applyErrorMap(
  map: AnyErrorMap,
  target: object,
  key: string | symbol,
  descriptor: PropertyDescriptor,
): void {
  SetMetadata(ERROR_MAP_METADATA, map)(target, key, descriptor);
  UseInterceptors(ResultInterceptor)(target, key, descriptor);
}
```

`src/http/map-errors.decorator.ts`:

```ts
import type { AnyErrorMap, ErrorMapCheck } from '../core/error-map.js';
import type { ErrorOfReturn, ResultReturningMethod } from '../core/result-source.js';
import { applyErrorMap } from './apply-error-map.js';

export type MapErrorsDecorator<M> = <F extends ResultReturningMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F> & ErrorMapCheck<ErrorOfReturn<ReturnType<F>>, M>,
) => void;

export function MapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M> {
  return (target, key, descriptor) => applyErrorMap(map, target, key, descriptor);
}
```

`src/http/result.module.ts`:

```ts
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResultInterceptor } from './result.interceptor.js';

@Module({})
export class ResultModule {
  static forRoot(): DynamicModule {
    return {
      module: ResultModule,
      global: true,
      providers: [{ provide: APP_INTERCEPTOR, useClass: ResultInterceptor }],
    };
  }
}
```

Append to `src/index.ts`:

```ts
export { MapErrors } from './http/map-errors.decorator.js';
export type { MapErrorsDecorator } from './http/map-errors.decorator.js';
export { ResultInterceptor } from './http/result.interceptor.js';
export { ResultModule } from './http/result.module.js';
```

- [ ] **Step 7: Run to verify they pass**

Run: `npx vitest run test/http && npm run typecheck`
Expected: 23 tests PASS (7 per platform × 2, the safety-net test, and 8 `toHttp` tests). Nest logs `MissingErrorMapError` and `DuplicateNeverthrowError` through `ExceptionsHandler`; that output is expected. Typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src test
git commit -m "add map errors decorator"
```

---

### Task 6: Compiler diagnostics tests

**Files:**
- Create: `test/diagnostics/tsconfig.json`, `test/diagnostics/compile-fixtures.ts`, `test/diagnostics/fixtures/*.ts`, `vitest.snapshot.config.ts`
- Modify: `package.json` (scripts)
- Test: `test/diagnostics/diagnostics.test.ts`, `test/diagnostics/diagnostics.snapshot.test.ts`

**Interfaces:**
- Consumes: `toHttp`, `MapErrors`, `TaggedError` from `src/index.ts`.
- Produces: `compileFixtures(): ReadonlyMap<string, string>` keyed by fixture file name without extension. The `TSC_BIN` environment variable selects the compiler, which Task 11's CI uses for the TypeScript matrix.

- [ ] **Step 1: Write the fixture project** `test/diagnostics/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "noEmit": true },
  "include": ["fixtures"],
  "exclude": []
}
```

- [ ] **Step 2: Write the fixtures**

`test/diagnostics/fixtures/errors.ts`:

```ts
import { TaggedError } from '../../../src/index.js';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}

export class AccessDenied extends TaggedError('AccessDenied') {}
```

`test/diagnostics/fixtures/to-http-missing-key.ts`:

```ts
import type { ResultAsync } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { AccessDenied, DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound | AccessDenied>;

export const response = toHttp(found, { DealNotFound: 404 });
```

`test/diagnostics/fixtures/to-http-stale-key.ts`:

```ts
import type { ResultAsync } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound>;

export const response = toHttp(found, { DealNotFound: 404, Stale: 500 });
```

`test/diagnostics/fixtures/to-http-untagged.ts`:

```ts
import type { Result } from 'neverthrow';
import { toHttp } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: Result<number, DealNotFound | Error>;

export const response = toHttp(found, { DealNotFound: 404 });
```

`test/diagnostics/fixtures/decorator-missing-key.ts`:

```ts
import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { AccessDenied, DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound | AccessDenied>;

export class DealsController {
  @MapErrors({ DealNotFound: 404 })
  find(): ResultAsync<number, DealNotFound | AccessDenied> {
    return found;
  }
}
```

`test/diagnostics/fixtures/decorator-stale-key.ts`:

```ts
import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound>;

export class DealsController {
  @MapErrors({ DealNotFound: 404, Stale: 500 })
  find(): ResultAsync<number, DealNotFound> {
    return found;
  }
}
```

`test/diagnostics/fixtures/decorator-untagged.ts`:

```ts
import type { Result } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { DealNotFound } from './errors.js';

declare const found: Result<number, DealNotFound | Error>;

export class DealsController {
  @MapErrors({ DealNotFound: 404 })
  find(): Result<number, DealNotFound | Error> {
    return found;
  }
}
```

`test/diagnostics/fixtures/decorator-body-mismatch.ts`:

```ts
import type { ResultAsync } from 'neverthrow';
import { MapErrors } from '../../../src/index.js';
import type { AccessDenied, DealNotFound } from './errors.js';

declare const found: ResultAsync<number, DealNotFound | AccessDenied>;

export class DealsController {
  @MapErrors({ DealNotFound: { status: 404, body: (error: AccessDenied) => ({ tag: error._tag }) }, AccessDenied: 403 })
  find(): ResultAsync<number, DealNotFound | AccessDenied> {
    return found;
  }
}
```

- [ ] **Step 3: Write the compiler runner** `test/diagnostics/compile-fixtures.ts`

```ts
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const tsc = process.env['TSC_BIN'] ?? resolve('node_modules', '.bin', 'tsc');
const project = resolve('test', 'diagnostics', 'tsconfig.json');

export function compileFixtures(): ReadonlyMap<string, string> {
  const { stdout } = spawnSync(tsc, ['-p', project, '--pretty', 'false'], { encoding: 'utf8' });
  return groupByFixture(stdout);
}

function groupByFixture(output: string): ReadonlyMap<string, string> {
  const blocks = output.split(/\n(?=\S)/).filter((block) => block.trim().length > 0);
  return blocks.reduce((groups, block) => {
    const fixture = /fixtures\/([\w-]+)\.ts\(/.exec(block)?.[1] ?? 'unknown';
    return new Map(groups).set(fixture, `${groups.get(fixture) ?? ''}${block}\n`);
  }, new Map<string, string>());
}
```

- [ ] **Step 4: Write the marker tests** in `test/diagnostics/diagnostics.test.ts`

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { compileFixtures } from './compile-fixtures.js';

describe('compiler diagnostics for common mistakes', () => {
  let diagnostics: ReadonlyMap<string, string>;

  beforeAll(() => {
    diagnostics = compileFixtures();
  });

  it('names the missing tag when toHttp omits a mapping', () => {
    expect(diagnostics.get('to-http-missing-key')).toContain("Property 'AccessDenied' is missing");
  });

  it('names the stale key when toHttp maps a tag that cannot occur', () => {
    expect(diagnostics.get('to-http-stale-key')).toContain('StaleErrorMapKeys<"Stale">');
  });

  it('names the untagged error when toHttp receives one', () => {
    expect(diagnostics.get('to-http-untagged')).toContain('UntaggedErrorsCannotBeMapped<Error>');
  });

  it('names the missing tag when MapErrors omits a mapping', () => {
    expect(diagnostics.get('decorator-missing-key')).toContain('MissingErrorMapKeys<"AccessDenied">');
  });

  it('names the stale key when MapErrors maps a tag that cannot occur', () => {
    expect(diagnostics.get('decorator-stale-key')).toContain('StaleErrorMapKeys<"Stale">');
  });

  it('names the untagged error when MapErrors decorates a method returning one', () => {
    expect(diagnostics.get('decorator-untagged')).toContain('UntaggedErrorsCannotBeMapped<Error>');
  });

  it('flags a body function annotated with the wrong error type', () => {
    expect(diagnostics.get('decorator-body-mismatch')).toContain('ErrorBodyParameterMismatch<');
  });

  it('reports nothing outside the fixtures', () => {
    expect(diagnostics.has('unknown')).toBe(false);
  });
});
```

- [ ] **Step 5: Run the marker tests**

Run: `npx vitest run test/diagnostics/diagnostics.test.ts`
Expected: 8 tests PASS. If one fails, print `compileFixtures()` for that fixture and compare it with the marker. A different message means the type-level rule regressed; do not loosen the marker.

- [ ] **Step 6: Add the snapshot test and its config**

`test/diagnostics/diagnostics.snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compileFixtures } from './compile-fixtures.js';

describe('compiler diagnostics text', () => {
  it('matches the recorded diagnostics for every fixture', () => {
    const ordered = [...compileFixtures()].sort(([left], [right]) => left.localeCompare(right));
    expect(ordered).toMatchSnapshot();
  });
});
```

`vitest.snapshot.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/diagnostics/*.snapshot.test.ts'],
    testTimeout: 60_000,
  },
});
```

Add to the `scripts` in `package.json`:

```json
"test:diagnostics-snapshot": "vitest run --config vitest.snapshot.config.ts"
```

- [ ] **Step 7: Record and inspect the snapshot**

Run: `npm run test:diagnostics-snapshot`
Expected: PASS, writing `test/diagnostics/__snapshots__/diagnostics.snapshot.test.ts.snap`. Open it and confirm each fixture's last diagnostic line names the marker type (`MissingErrorMapKeys<"AccessDenied">` and so on). This file is the readable record of what developers will see.

- [ ] **Step 8: Commit**

```bash
git add package.json test vitest.snapshot.config.ts
git commit -m "pin compiler diagnostics"
```

---

### Task 7: Swagger entry point

**Files:**
- Create: `src/swagger/map-errors.decorator.ts`, `src/swagger/index.ts`
- Test: `test/swagger/map-errors-swagger.test.ts`

**Interfaces:**
- Consumes: `applyErrorMap` and `MapErrorsDecorator` (Task 5); `statusOf` (Task 3); `AnyErrorMap` (Task 2).
- Produces: `MapErrors` from `nest-result/swagger`, same signature as the core `MapErrors`.

- [ ] **Step 1: Install Swagger and settle its install script**

```bash
npm install -D @nestjs/swagger@^12.0.2
npm install-scripts deny @scarf/scarf
```

Expected: `allowScripts` in `package.json` records `@scarf/scarf` as denied. It is telemetry and has no functional role.

- [ ] **Step 2: Write the failing test** in `test/swagger/map-errors-swagger.test.ts`

```ts
import { Controller, Get, type INestApplication, Param } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { errAsync, okAsync, type ResultAsync } from 'neverthrow';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MapErrors } from '../../src/swagger/index.js';
import { createApp } from '../support/create-app.js';
import { AccessDenied, DealNotFound, Unavailable } from '../support/errors.js';

@Controller('deals')
class DealsController {
  @Get(':id')
  @MapErrors({
    DealNotFound: 404,
    AccessDenied: 404,
    Unavailable: { status: 503, body: (e: Unavailable) => ({ retry: e._tag }) },
  })
  find(@Param('id') id: string): ResultAsync<{ id: string }, DealNotFound | AccessDenied | Unavailable> {
    return id === 'x' ? errAsync(new AccessDenied()) : okAsync({ id });
  }
}

describe('swagger MapErrors', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createApp('express', { controllers: [DealsController] });
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents one response per distinct status, listing the tags that share it', () => {
    const responses = document.paths['/deals/{id}']?.get?.responses;
    expect(responses).toMatchObject({
      '404': { description: 'DealNotFound, AccessDenied' },
      '503': { description: 'Unavailable' },
    });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run test/swagger`
Expected: FAIL, cannot resolve `../../src/swagger/index.js`.

- [ ] **Step 4: Implement** `src/swagger/map-errors.decorator.ts`

```ts
import { ApiResponse } from '@nestjs/swagger';
import type { AnyErrorMap } from '../core/error-map.js';
import { statusOf } from '../core/resolve-http-error.js';
import { applyErrorMap } from '../http/apply-error-map.js';
import type { MapErrorsDecorator } from '../http/map-errors.decorator.js';

export function MapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M> {
  return (target, key, descriptor) => {
    applyErrorMap(map, target, key, descriptor);
    tagsByStatus(map).forEach((tags, status) =>
      ApiResponse({ status, description: tags.join(', ') })(target, key, descriptor),
    );
  };
}

function tagsByStatus(map: AnyErrorMap): ReadonlyMap<number, readonly string[]> {
  return Object.entries(map).reduce((groups, [tag, spec]) => {
    const status = statusOf(spec);
    return new Map(groups).set(status, [...(groups.get(status) ?? []), tag]);
  }, new Map<number, readonly string[]>());
}
```

`src/swagger/index.ts`:

```ts
export { MapErrors } from './map-errors.decorator.js';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/swagger && npm run typecheck`
Expected: 1 test PASS; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src test
git commit -m "add swagger entry point"
```

---

### Task 8: withResultTransaction

**Files:**
- Create: `src/transactional/rollback-signal.ts`, `src/transactional/with-result-transaction.ts`, `src/transactional/index.ts`
- Test: `test/transactional/with-result-transaction.test.ts`

**Interfaces:**
- Consumes: `TransactionHost`, `Propagation` from `@nestjs-cls/transactional`; `ResultAsync`, `Result` from neverthrow.
- Produces:
  - `type TransactionOptionsOf<TAdapter> = Parameters<TransactionHost<TAdapter>['withTransaction']>[1]`
  - `type ResultTransactionSettings<TAdapter> = { readonly propagation?: Propagation; readonly options?: TransactionOptionsOf<TAdapter> }`
  - `withResultTransaction<T, E, TAdapter = never>(txHost: TransactionHost<TAdapter>, fn: () => PromiseLike<Result<T, E>>, settings?: ResultTransactionSettings<TAdapter>): ResultAsync<T, E>`
  - Internal `RollbackSignal` (not exported from the entry point).

- [ ] **Step 1: Install the transactional peers for development**

```bash
npm install -D nestjs-cls@^7.0.1 @nestjs-cls/transactional@^4.0.1
```

- [ ] **Step 2: Write the failing tests** in `test/transactional/with-result-transaction.test.ts`

```ts
import { Propagation, type TransactionHost } from '@nestjs-cls/transactional';
import { errAsync, ok, okAsync, type Result } from 'neverthrow';
import { describe, expect, it } from 'vitest';
import { TaggedError } from '../../src/index.js';
import { withResultTransaction } from '../../src/transactional/index.js';

class Rejected extends TaggedError('Rejected') {}

type RecordingHost = {
  readonly host: TransactionHost<never>;
  readonly outcomes: string[];
  readonly calls: unknown[][];
};

function recordingHost(): RecordingHost {
  const outcomes: string[] = [];
  const calls: unknown[][] = [];
  const withTransaction = async (...args: unknown[]): Promise<unknown> => {
    calls.push(args.slice(0, -1));
    const fn = args.at(-1) as () => Promise<unknown>;
    try {
      const value = await fn();
      outcomes.push('commit');
      return value;
    } catch (thrown) {
      outcomes.push('rollback');
      throw thrown;
    }
  };
  return { host: { withTransaction } as unknown as TransactionHost<never>, outcomes, calls };
}

describe('withResultTransaction', () => {
  it('commits and resolves to the Ok', async () => {
    const { host, outcomes } = recordingHost();
    const result = await withResultTransaction(host, () => okAsync(1));
    expect({ value: result._unsafeUnwrap(), outcomes }).toEqual({ value: 1, outcomes: ['commit'] });
  });

  it('rolls back and resolves to the same Err', async () => {
    const { host, outcomes } = recordingHost();
    const rejected = new Rejected();
    const result = await withResultTransaction(host, () => errAsync(rejected));
    expect({ error: result._unsafeUnwrapErr(), outcomes }).toEqual({ error: rejected, outcomes: ['rollback'] });
  });

  it('accepts a function returning a Promise of a Result', async () => {
    const { host } = recordingHost();
    const result = await withResultTransaction(host, async (): Promise<Result<number, Rejected>> => ok(2));
    expect(result._unsafeUnwrap()).toBe(2);
  });

  it('rolls back and rethrows an exception unchanged', async () => {
    const { host, outcomes } = recordingHost();
    const boom = new Error('boom');
    const pending = withResultTransaction(host, async (): Promise<Result<number, Rejected>> => {
      throw boom;
    });
    await expect(pending).rejects.toBe(boom);
    expect(outcomes).toEqual(['rollback']);
  });

  it('keeps concurrent transactions isolated', async () => {
    const { host } = recordingHost();
    const [failed, succeeded] = await Promise.all([
      withResultTransaction(host, () => errAsync(new Rejected())),
      withResultTransaction(host, () => okAsync('fine')),
    ]);
    expect([failed.isErr(), succeeded.isOk()]).toEqual([true, true]);
  });

  it('passes propagation and options through to the transaction host', async () => {
    const { host, calls } = recordingHost();
    await withResultTransaction(host, () => okAsync(1), {
      propagation: Propagation.RequiresNew,
      options: { isolationLevel: 'SERIALIZABLE' } as never,
    });
    expect(calls).toEqual([[Propagation.RequiresNew, { isolationLevel: 'SERIALIZABLE' }]]);
  });

  it('calls the transaction host with only the callback when no settings are given', async () => {
    const { host, calls } = recordingHost();
    await withResultTransaction(host, () => okAsync(1));
    expect(calls).toEqual([[]]);
  });

  it('lets an outer transaction recover from a joined inner Err', async () => {
    const { host } = recordingHost();
    const result = await withResultTransaction(host, () =>
      withResultTransaction(host, () => errAsync(new Rejected())).orElse(() => ok('recovered')),
    );
    expect(result._unsafeUnwrap()).toBe('recovered');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run test/transactional/with-result-transaction.test.ts`
Expected: FAIL, cannot resolve `../../src/transactional/index.js`.

- [ ] **Step 4: Implement** `src/transactional/rollback-signal.ts`

```ts
import type { Err } from 'neverthrow';

export class RollbackSignal<T, E> extends Error {
  constructor(
    readonly owner: symbol,
    readonly result: Err<T, E>,
  ) {
    super('nest-result rollback signal');
    this.name = 'RollbackSignal';
  }

  static isOwnedBy<T, E>(thrown: unknown, owner: symbol): thrown is RollbackSignal<T, E> {
    return thrown instanceof RollbackSignal && thrown.owner === owner;
  }
}
```

`src/transactional/with-result-transaction.ts`:

```ts
import type { Propagation, TransactionHost } from '@nestjs-cls/transactional';
import { ResultAsync, type Result } from 'neverthrow';
import { RollbackSignal } from './rollback-signal.js';

export type TransactionOptionsOf<TAdapter> = Parameters<TransactionHost<TAdapter>['withTransaction']>[1];

export type ResultTransactionSettings<TAdapter> = {
  readonly propagation?: Propagation;
  readonly options?: TransactionOptionsOf<TAdapter>;
};

export function withResultTransaction<T, E, TAdapter = never>(
  txHost: TransactionHost<TAdapter>,
  fn: () => PromiseLike<Result<T, E>>,
  settings: ResultTransactionSettings<TAdapter> = {},
): ResultAsync<T, E> {
  return new ResultAsync(runRollingBackOnErr(txHost, fn, settings));
}

async function runRollingBackOnErr<T, E, TAdapter>(
  txHost: TransactionHost<TAdapter>,
  fn: () => PromiseLike<Result<T, E>>,
  settings: ResultTransactionSettings<TAdapter>,
): Promise<Result<T, E>> {
  const owner = Symbol('nest-result transaction');
  try {
    return await startTransaction(txHost, settings, async () => {
      const result = await fn();
      if (result.isErr()) throw new RollbackSignal(owner, result);
      return result;
    });
  } catch (thrown) {
    if (RollbackSignal.isOwnedBy<T, E>(thrown, owner)) return thrown.result;
    throw thrown;
  }
}

function startTransaction<R, TAdapter>(
  txHost: TransactionHost<TAdapter>,
  { propagation, options }: ResultTransactionSettings<TAdapter>,
  fn: () => Promise<R>,
): Promise<R> {
  if (propagation !== undefined && options !== undefined) return txHost.withTransaction(propagation, options, fn);
  if (propagation !== undefined) return txHost.withTransaction(propagation, fn);
  if (options !== undefined) return txHost.withTransaction(options, fn);
  return txHost.withTransaction(fn);
}
```

`src/transactional/index.ts`:

```ts
export { withResultTransaction } from './with-result-transaction.js';
export type { ResultTransactionSettings, TransactionOptionsOf } from './with-result-transaction.js';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/transactional && npm run typecheck`
Expected: 8 tests PASS; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src test
git commit -m "roll back transactions on err"
```

---

### Task 9: TransactionalResult decorator

**Files:**
- Create: `src/transactional/transactional-result.decorator.ts`
- Modify: `src/transactional/index.ts`
- Test: `test/transactional/sqlite-transactions.test.ts`

**Interfaces:**
- Consumes: `withResultTransaction`, `ResultTransactionSettings`, `TransactionOptionsOf` (Task 8); `MapErrors`, `TaggedError` (Tasks 1 and 5); `TransactionHost.getInstance`, `Propagation` from `@nestjs-cls/transactional`; `copyMethodMetadata` from `nestjs-cls`.
- Produces: `TransactionalResult(...)` with the overloads `()`, `(propagation)`, `(options)`, `(propagation, options)`, `(connectionName, propagation?, options?)`, returning `TransactionalResultDecorator`, which only accepts methods returning `Promise<Result<unknown, unknown>>`.

- [ ] **Step 1: Install the database test dependencies and approve the native build**

```bash
npm install -D typeorm@^1.1.1 better-sqlite3@^12.11.1 @nestjs-cls/transactional-adapter-typeorm@^2.0.1
npm install-scripts approve better-sqlite3
npm rebuild better-sqlite3
```

Expected: `node_modules/better-sqlite3/build/Release/better_sqlite3.node` exists. Use better-sqlite3 12, not 13; TypeORM 1.1 declares `^12` as its peer.

- [ ] **Step 2: Write the failing tests** in `test/transactional/sqlite-transactions.test.ts`

```ts
import 'reflect-metadata';
import { Controller, type DynamicModule, Inject, Injectable, type INestApplication, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClsPluginTransactional, Propagation, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsModule } from 'nestjs-cls';
import { err, ok, type Result } from 'neverthrow';
import request from 'supertest';
import { DataSource, EntitySchema } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MapErrors, TaggedError } from '../../src/index.js';
import { TransactionalResult } from '../../src/transactional/index.js';

type DealRow = { id: number; title: string };

const DealSchema = new EntitySchema<DealRow>({
  name: 'deal',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    title: { type: String },
  },
});

class CreationRejected extends TaggedError('CreationRejected') {}

@Injectable()
class DealWriter {
  constructor(
    @Inject(TransactionHost) private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  @TransactionalResult()
  async insertThenSucceed(title: string): Promise<Result<void, CreationRejected>> {
    await this.insert(title);
    return ok(undefined);
  }

  @TransactionalResult()
  async insertThenFail(title: string): Promise<Result<void, CreationRejected>> {
    await this.insert(title);
    return err(new CreationRejected());
  }

  @TransactionalResult()
  async insertThenThrow(title: string): Promise<Result<void, CreationRejected>> {
    await this.insert(title);
    throw new Error('boom');
  }

  @TransactionalResult(Propagation.Nested)
  async insertInSavepointThenFail(title: string): Promise<Result<void, CreationRejected>> {
    await this.insert(title);
    return err(new CreationRejected());
  }

  private async insert(title: string): Promise<void> {
    await this.txHost.tx.getRepository(DealSchema).insert({ title });
  }
}

@Injectable()
class DealWorkflow {
  constructor(@Inject(DealWriter) private readonly writer: DealWriter) {}

  @TransactionalResult()
  async outerRecoversFromJoinedFailure(): Promise<Result<void, CreationRejected>> {
    await this.writer.insertThenSucceed('outer');
    const inner = await this.writer.insertThenFail('inner');
    return inner.orElse(() => ok(undefined));
  }

  @TransactionalResult()
  async outerRecoversFromSavepointFailure(): Promise<Result<void, CreationRejected>> {
    await this.writer.insertThenSucceed('outer');
    const inner = await this.writer.insertInSavepointThenFail('inner');
    return inner.orElse(() => ok(undefined));
  }
}

@Controller('deals')
class DealsController {
  constructor(@Inject(DealWriter) private readonly writer: DealWriter) {}

  @Post()
  @TransactionalResult()
  @MapErrors({ CreationRejected: 409 })
  async create(): Promise<Result<void, CreationRejected>> {
    return this.writer.insertThenFail('via-http');
  }
}

@Module({})
class DataSourceHolderModule {}

describe('TransactionalResult with TypeORM on SQLite', () => {
  let dataSource: DataSource;
  let app: INestApplication;

  beforeEach(async () => {
    dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: [DealSchema], synchronize: true });
    await dataSource.initialize();
    const dataSourceModule: DynamicModule = {
      module: DataSourceHolderModule,
      providers: [{ provide: DataSource, useValue: dataSource }],
      exports: [DataSource],
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [dataSourceModule],
              adapter: new TransactionalAdapterTypeOrm({ dataSourceToken: DataSource }),
            }),
          ],
        }),
      ],
      controllers: [DealsController],
      providers: [DealWriter, DealWorkflow],
    }).compile();
    app = await moduleRef.createNestApplication().init();
  });

  afterEach(async () => {
    await app.close();
    await dataSource.destroy();
  });

  const titles = async () =>
    (await dataSource.getRepository(DealSchema).find({ order: { id: 'ASC' } })).map((row) => row.title);

  it('commits when the method returns Ok', async () => {
    await app.get(DealWriter).insertThenSucceed('kept');
    expect(await titles()).toEqual(['kept']);
  });

  it('rolls back when the method returns Err', async () => {
    await app.get(DealWriter).insertThenFail('discarded');
    expect(await titles()).toEqual([]);
  });

  it('returns the original Err after rolling back', async () => {
    const result = await app.get(DealWriter).insertThenFail('discarded');
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(CreationRejected);
  });

  it('rolls back and rethrows when the method throws', async () => {
    await expect(app.get(DealWriter).insertThenThrow('discarded')).rejects.toThrow('boom');
    expect(await titles()).toEqual([]);
  });

  it('commits a joined inner write when the outer caller recovers from its Err', async () => {
    await app.get(DealWorkflow).outerRecoversFromJoinedFailure();
    expect(await titles()).toEqual(['outer', 'inner']);
  });

  it('rolls back only the savepoint when a Nested inner method returns Err', async () => {
    await app.get(DealWorkflow).outerRecoversFromSavepointFailure();
    expect(await titles()).toEqual(['outer']);
  });

  it('keeps MapErrors working when TransactionalResult is applied on top of it', async () => {
    const response = await request(app.getHttpServer()).post('/deals');
    expect({ status: response.status, code: response.body.code }).toEqual({ status: 409, code: 'CreationRejected' });
  });

  it('returns a real Promise from the decorated method', async () => {
    const pending = app.get(DealWriter).insertThenSucceed('kept');
    expect(pending).toBeInstanceOf(Promise);
    await pending;
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run test/transactional/sqlite-transactions.test.ts`
Expected: FAIL, `TransactionalResult` is not exported from `../../src/transactional/index.js`.

- [ ] **Step 4: Implement** `src/transactional/transactional-result.decorator.ts`

```ts
import { Propagation, TransactionHost } from '@nestjs-cls/transactional';
import { copyMethodMetadata } from 'nestjs-cls';
import type { Result } from 'neverthrow';
import {
  type ResultTransactionSettings,
  type TransactionOptionsOf,
  withResultTransaction,
} from './with-result-transaction.js';

type AsyncResultMethod = (...args: never[]) => Promise<Result<unknown, unknown>>;

export type TransactionalResultDecorator = <F extends AsyncResultMethod>(
  target: object,
  key: string | symbol,
  descriptor: TypedPropertyDescriptor<F>,
) => void;

type TransactionTarget = {
  readonly connectionName: string | undefined;
  readonly settings: ResultTransactionSettings<unknown>;
};

export function TransactionalResult<TAdapter = never>(): TransactionalResultDecorator;
export function TransactionalResult<TAdapter = never>(propagation: Propagation): TransactionalResultDecorator;
export function TransactionalResult<TAdapter = never>(
  options: TransactionOptionsOf<TAdapter>,
): TransactionalResultDecorator;
export function TransactionalResult<TAdapter = never>(
  propagation: Propagation,
  options: TransactionOptionsOf<TAdapter>,
): TransactionalResultDecorator;
export function TransactionalResult<TAdapter = never>(
  connectionName: string,
  propagation?: Propagation,
  options?: TransactionOptionsOf<TAdapter>,
): TransactionalResultDecorator;
export function TransactionalResult(...args: readonly unknown[]): TransactionalResultDecorator {
  const target = parseArguments(args);
  return (_target, key, descriptor) => {
    const original = descriptor.value;
    if (original === undefined) {
      throw new TypeError(`@TransactionalResult can only decorate methods, but ${String(key)} is not a method`);
    }
    descriptor.value = wrapInTransaction(original, target);
  };
}

function wrapInTransaction<F extends AsyncResultMethod>(original: F, target: TransactionTarget): F {
  const wrapped = async function (this: unknown, ...args: never[]): Promise<Result<unknown, unknown>> {
    return withResultTransaction(
      TransactionHost.getInstance<unknown>(target.connectionName),
      () => original.apply(this, args),
      target.settings,
    );
  };
  Object.defineProperty(wrapped, 'name', { value: original.name });
  copyMethodMetadata(original, wrapped);
  return wrapped as unknown as F;
}

function parseArguments(args: readonly unknown[]): TransactionTarget {
  const [first, ...rest] = args;
  if (typeof first === 'string' && !isPropagation(first)) {
    return { connectionName: first, settings: settingsFrom(rest) };
  }
  return { connectionName: undefined, settings: settingsFrom(args) };
}

function settingsFrom(args: readonly unknown[]): ResultTransactionSettings<unknown> {
  const [first, second] = args;
  if (isPropagation(first)) return { propagation: first, options: second as TransactionOptionsOf<unknown> };
  return { options: first as TransactionOptionsOf<unknown> };
}

function isPropagation(value: unknown): value is Propagation {
  return (Object.values(Propagation) as readonly unknown[]).includes(value);
}
```

Replace `src/transactional/index.ts` with:

```ts
export { withResultTransaction } from './with-result-transaction.js';
export type { ResultTransactionSettings, TransactionOptionsOf } from './with-result-transaction.js';
export { TransactionalResult } from './transactional-result.decorator.js';
export type { TransactionalResultDecorator } from './transactional-result.decorator.js';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/transactional && npm run typecheck`
Expected: 16 tests PASS (8 from Task 8, 8 new); typecheck exits 0.

- [ ] **Step 6: Mutation check that the rollback tests can fail**

Temporarily change the line `if (result.isErr()) throw new RollbackSignal(owner, result);` in `src/transactional/with-result-transaction.ts` to `if (result.isErr() && owner === undefined) throw new RollbackSignal(owner, result);`, then run `npx vitest run test/transactional/sqlite-transactions.test.ts`.
Expected: exactly `rolls back when the method returns Err` and `rolls back only the savepoint when a Nested inner method returns Err` FAIL. Then restore the original line with `git checkout src/transactional/with-result-transaction.ts` and re-run: 8 PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src test
git commit -m "add transactional result decorator"
```

---

### Task 10: Build and package verification

**Files:**
- Create: `tsup.config.ts`, `tsconfig.build.json`, `scripts/write-cjs-entry-points.js`, `vitest.package.config.ts`, `test/package/smoke.test.ts`
- Modify: `package.json`, `vitest.config.ts`

**Interfaces:**
- Consumes: the three entry points `src/index.ts`, `src/swagger/index.ts`, `src/transactional/index.ts`.
- Produces: `dist/{index,swagger,transactional}.{js,d.ts,d.cts}` plus shared ESM chunks, and `dist/{index,swagger,transactional}.cjs` wrappers; the `exports` map; the scripts `build`, `test:package`, `lint:package`, `check`.

- [ ] **Step 1: Install build tooling**

```bash
npm install -D tsup@^8.5.1 publint@^0.3.24 @arethetypeswrong/cli@^0.18.5
```

- [ ] **Step 2: Write the failing smoke test** in `test/package/smoke.test.ts`

```ts
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function run(args: readonly string[]): string {
  return execFileSync(process.execPath, args, { encoding: 'utf8' }).trim();
}

describe('built package', () => {
  it('shares one implementation between require and import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const required = [require('nest-result').MapErrors, require('nest-result').UnmappedErrorTagError, require('nest-result/transactional').TransactionalResult]; const imported = [(await import('nest-result')).MapErrors, (await import('nest-result')).UnmappedErrorTagError, (await import('nest-result/transactional')).TransactionalResult]; console.log(required.every((value, index) => value === imported[index]))",
    ]);
    expect(output).toBe('true');
  });

  it('refuses deep imports into dist', () => {
    const output = run([
      '-e',
      "try { require('nest-result/dist/index.js'); console.log('resolved') } catch (error) { console.log(error.code) }",
    ]);
    expect(output).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });

  it('loads every entry point through require', () => {
    const output = run([
      '-e',
      "const core = require('nest-result'); const swagger = require('nest-result/swagger'); const tx = require('nest-result/transactional'); console.log([typeof core.MapErrors, typeof core.TaggedError, typeof swagger.MapErrors, typeof tx.TransactionalResult].join(','))",
    ]);
    expect(output).toBe('function,function,function,function');
  });

  it('loads every entry point through import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "const core = await import('nest-result'); const swagger = await import('nest-result/swagger'); const tx = await import('nest-result/transactional'); console.log([typeof core.ResultModule, typeof core.toHttp, typeof swagger.MapErrors, typeof tx.withResultTransaction].join(','))",
    ]);
    expect(output).toBe('function,function,function,function');
  });
});
```

The package resolves itself by name through its own `exports` map, so these tests exercise the built `dist` exactly as consumers do. The first test is the single-copy guarantee: a CommonJS host and an ESM host must get the very same classes.

- [ ] **Step 3: Keep the smoke test out of the default run and give it its own config**

The smoke test needs `dist`, so `npm test` must not pick it up on a fresh clone. In `vitest.config.ts` change the `exclude` line to:

```ts
    exclude: ['test/**/*.snapshot.test.ts', 'test/package/**', 'node_modules/**'],
```

`vitest.package.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/package/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
```

Add to `scripts` in `package.json`: `"test:package": "vitest run --config vitest.package.config.ts"`.

Run: `npm run test:package`
Expected: FAIL, `Cannot find module 'nest-result'` (no `exports` map or `dist` yet).

- [ ] **Step 4: Write `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "types": [], "ignoreDeprecations": "6.0" },
  "include": ["src"],
  "exclude": []
}
```

`ignoreDeprecations` is required: tsup's declaration step injects `baseUrl`, which TypeScript 6 flags as deprecated (TS5101).

tsup still builds both formats, because its CommonJS pass is what produces the `.d.cts` declarations. `scripts/write-cjs-entry-points.js` then deletes every compiled `.cjs` file and writes one wrapper per entry point, so CommonJS hosts load the ESM implementation through `require(esm)`:

```js
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const entryPoints = ['index', 'swagger', 'transactional'];
const isCompiledCommonJs = (file) => file.endsWith('.cjs') || file.endsWith('.cjs.map');

readdirSync(dist)
  .filter(isCompiledCommonJs)
  .forEach((file) => rmSync(join(dist, file)));

entryPoints.forEach((entryPoint) =>
  writeFileSync(join(dist, `${entryPoint}.cjs`), `module.exports = require('./${entryPoint}.js');\n`),
);
```

`tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    swagger: 'src/swagger/index.ts',
    transactional: 'src/transactional/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  clean: true,
  sourcemap: true,
  target: 'node22',
  tsconfig: 'tsconfig.build.json',
});
```

- [ ] **Step 5: Add the package entry fields and scripts to `package.json`**

Add these top-level fields after `"files"`:

```json
"main": "./dist/index.cjs",
"module": "./dist/index.js",
"types": "./dist/index.d.cts",
"exports": {
  ".": {
    "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  },
  "./swagger": {
    "import": { "types": "./dist/swagger.d.ts", "default": "./dist/swagger.js" },
    "require": { "types": "./dist/swagger.d.cts", "default": "./dist/swagger.cjs" }
  },
  "./transactional": {
    "import": { "types": "./dist/transactional.d.ts", "default": "./dist/transactional.js" },
    "require": { "types": "./dist/transactional.d.cts", "default": "./dist/transactional.cjs" }
  },
  "./package.json": "./package.json"
},
"typesVersions": {
  "*": {
    "swagger": ["./dist/swagger.d.cts"],
    "transactional": ["./dist/transactional.d.cts"]
  }
},
```

`typesVersions` makes the subpath types resolve for projects still on `moduleResolution: node`.

Replace `scripts` with:

```json
"scripts": {
  "build": "tsup && node scripts/write-cjs-entry-points.js",
  "typecheck": "tsc -p tsconfig.json",
  "test": "vitest run",
  "test:diagnostics-snapshot": "vitest run --config vitest.snapshot.config.ts",
  "test:package": "vitest run --config vitest.package.config.ts",
  "lint:package": "publint --strict && attw --pack .",
  "check": "npm run typecheck && npm test && npm run build && npm run test:package && npm run lint:package"
}
```

- [ ] **Step 6: Build and verify**

Run: `npm run build && npm run test:package && npm run lint:package`
Expected: `dist/` contains `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts` and the same for `swagger` and `transactional`, plus `chunk-*.js` files and no other `.cjs` file; `cat dist/index.cjs` prints `module.exports = require('./index.js');`; 4 smoke tests PASS; `publint --strict` prints `All good!`; attw prints `No problems found 🌟`.

- [ ] **Step 7: Run the whole check**

Run: `npm run check`
Expected: exits 0. `npm test` reports 69 tests (21 core, 23 http, 8 diagnostics, 1 swagger, 16 transactional) and `test:package` reports 4.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsup.config.ts tsconfig.build.json scripts vitest.config.ts vitest.package.config.ts test/package
git commit -m "ship single-copy dual build"
```

---

### Task 11: CI and publish workflows

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/publish.yml`

**Interfaces:**
- Consumes: the scripts from Tasks 6, 10 and 12, and `TSC_BIN` from Task 6.
- Produces: `ci` on push and pull request, callable from `publish`; `publish` triggered by a published GitHub Release, staging the package through npm trusted publishing. Both follow the author's `nestjs-kafka` workflows.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:
  workflow_call:

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        nest: [11, 12]
    name: verify (nest ${{ matrix.nest }})
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - if: matrix.nest == 12
        run: npm ci
      - if: matrix.nest == 11
        run: |
          npm pkg set devDependencies.@nestjs/common=^11 devDependencies.@nestjs/core=^11 devDependencies.@nestjs/testing=^11 devDependencies.@nestjs/platform-express=^11 devDependencies.@nestjs/platform-fastify=^11 devDependencies.@nestjs/swagger=^11
          rm -rf node_modules package-lock.json
          npm install
      - run: |
          node -e "process.exit(require('./node_modules/@nestjs/core/package.json').version.startsWith('${{ matrix.nest }}.') ? 0 : 1)"
      - run: npm run check

  load:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    name: load (node 22.12.0)
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22.12.0
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run test:package

  typescript:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      fail-fast: false
      matrix:
        typescript: ['5.5.4', '6.0.3', '7.0.2']
    name: typescript ${{ matrix.typescript }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm install --prefix .ts-matrix typescript@${{ matrix.typescript }}
      - run: .ts-matrix/node_modules/.bin/tsc -p tsconfig.json
      - run: npx vitest run test/diagnostics/diagnostics.test.ts
        env:
          TSC_BIN: .ts-matrix/node_modules/.bin/tsc

  diagnostics-snapshot:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    name: diagnostics snapshot
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run test:diagnostics-snapshot

  example:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    name: example
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run example:build
```

The Nest 11 leg rewrites the dev ranges and resolves from scratch: `npm install --no-save @nestjs/...@11` keeps the lockfile's 12.x here, because other dev dependencies peer on Nest. The assertion step fails the job if the wrong major is installed. The `example` job runs the script added in Task 12; until Task 12 lands it fails, which is expected on this branch.

- [ ] **Step 2: Write `.github/workflows/publish.yml`**

```yaml
name: publish

on:
  release:
    types: [published]

permissions:
  contents: read

concurrency:
  group: publish-${{ github.event.release.tag_name }}
  cancel-in-progress: false

jobs:
  guard:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      dist-tag: ${{ steps.guard.outputs.dist-tag }}
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          package-manager-cache: false
      - id: guard
        env:
          TAG: ${{ github.event.release.tag_name }}
          PRERELEASE: ${{ github.event.release.prerelease }}
        run: |
          set -euo pipefail
          name=$(node -p "require('./package.json').name")
          version=$(node -p "require('./package.json').version")
          if [ "$TAG" != "v$version" ]; then
            echo "::error::Release tag $TAG does not match package.json version $version. The Release tag must be v$version on the commit that carries that version. Delete this Release and publish a new one."
            exit 1
          fi
          if ! git merge-base --is-ancestor HEAD origin/main; then
            echo "::error::Release tag $TAG points at a commit that is not on main. Merge the version bump to main, tag that commit, delete this Release, and publish a new one."
            exit 1
          fi
          core=${version%%+*}
          if [[ "$core" == *-* ]]; then
            expected_prerelease=true
            dist_tag=next
          else
            expected_prerelease=false
            dist_tag=latest
          fi
          if [ "$PRERELEASE" != "$expected_prerelease" ]; then
            echo "::error::Version $version needs the Release's pre-release box set to $expected_prerelease, but it is $PRERELEASE. Delete this Release and publish a new one from tag $TAG with the pre-release box set to $expected_prerelease."
            exit 1
          fi
          if npm view "$name@$version" version >"$RUNNER_TEMP/npm-view.out" 2>"$RUNNER_TEMP/npm-view.err"; then
            if [ -s "$RUNNER_TEMP/npm-view.out" ]; then
              echo "::error::$name@$version is already published. Bump the version in package.json."
              exit 1
            fi
          elif ! grep -q E404 "$RUNNER_TEMP/npm-view.err"; then
            echo "::error::Could not check whether $name@$version is already published."
            cat "$RUNNER_TEMP/npm-view.err"
            exit 1
          fi
          echo "dist-tag=$dist_tag" >> "$GITHUB_OUTPUT"

  ci:
    needs: guard
    uses: ./.github/workflows/ci.yml

  stage:
    needs: [guard, ci]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
          package-manager-cache: false
      - run: npm install -g npm@11.20.0
      - run: npm ci --ignore-scripts
      - run: npm run build
      - env:
          DIST_TAG: ${{ needs.guard.outputs.dist-tag }}
        run: |
          if [ "$DIST_TAG" = next ]; then
            npm stage publish --ignore-scripts --loglevel verbose --tag next
          else
            npm stage publish --ignore-scripts --loglevel verbose
          fi
```

`npm ci --ignore-scripts` in `stage` skips the native `better-sqlite3` build, which publishing does not need.

- [ ] **Step 3: Validate both workflow files parse**

Run: `npx -y js-yaml .github/workflows/ci.yml > /dev/null && npx -y js-yaml .github/workflows/publish.yml > /dev/null && echo ok`
Expected: `ok`.

- [ ] **Step 4: Reproduce the TypeScript and floor legs locally**

Run: `npm install --prefix .ts-matrix typescript@7.0.2 && .ts-matrix/node_modules/.bin/tsc -p tsconfig.json && TSC_BIN=.ts-matrix/node_modules/.bin/tsc npx vitest run test/diagnostics/diagnostics.test.ts`
Expected: tsc exits 0; 8 tests PASS.

Then run the load leg on the floor version: `npx -y node@22.12.0 --version` to confirm it is fetchable, and `npm run build && npx -y -p node@22.12.0 node -e "require('nest-result'); console.log('loaded')"`.
Expected: `v22.12.0`, then `loaded`.

- [ ] **Step 5: Commit**

```bash
git add .github
git commit -m "add ci and publish workflows"
```

---

### Task 12: README and example app

**Files:**
- Create: `README.md`
- Create: `examples/deals-api/package.json`, `examples/deals-api/tsconfig.json`, `examples/deals-api/src/main.ts`, `examples/deals-api/src/app.module.ts`, `examples/deals-api/src/deals/deal-errors.ts`, `examples/deals-api/src/deals/deals.service.ts`, `examples/deals-api/src/deals/deals.controller.ts`
- Modify: `package.json` (script `example:build`)

**Interfaces:**
- Consumes: the public API only, installed from the packed tarball, exactly as a user would.
- Produces: the README and a runnable example.

- [ ] **Step 1: Write the example's `package.json`**

`examples/deals-api/package.json`:

```json
{
  "name": "nest-result-example-deals-api",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@nestjs/common": "^12.1.2",
    "@nestjs/core": "^12.1.2",
    "@nestjs/platform-express": "^12.1.2",
    "neverthrow": "^8.2.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  },
  "devDependencies": {
    "@types/node": "^22",
    "typescript": "~6.0.3"
  }
}
```

`examples/deals-api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the example source**

`examples/deals-api/src/deals/deal-errors.ts`:

```ts
import { TaggedError } from 'nest-result';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}

export class DealAlreadyClosed extends TaggedError('DealAlreadyClosed')<{ dealId: string; message: string }> {}
```

`examples/deals-api/src/deals/deals.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { err, ok, type Result } from 'neverthrow';
import { DealAlreadyClosed, DealNotFound } from './deal-errors.js';

export type Deal = { readonly id: string; readonly title: string; readonly closed: boolean };

@Injectable()
export class DealsService {
  private deals: ReadonlyMap<string, Deal> = new Map([
    ['1', { id: '1', title: 'Office lease', closed: false }],
    ['2', { id: '2', title: 'Fleet renewal', closed: true }],
  ]);

  find(id: string): Result<Deal, DealNotFound> {
    const deal = this.deals.get(id);
    return deal ? ok(deal) : err(new DealNotFound({ dealId: id, message: `Deal ${id} does not exist` }));
  }

  close(id: string): Result<Deal, DealNotFound | DealAlreadyClosed> {
    return this.find(id).andThen((deal) => {
      if (deal.closed) return err(new DealAlreadyClosed({ dealId: id, message: `Deal ${id} is already closed` }));
      const closed = { ...deal, closed: true };
      this.deals = new Map(this.deals).set(id, closed);
      return ok(closed);
    });
  }
}
```

`examples/deals-api/src/deals/deals.controller.ts`:

```ts
import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import type { Result } from 'neverthrow';
import { MapErrors, toHttp } from 'nest-result';
import type { DealAlreadyClosed, DealNotFound } from './deal-errors.js';
import { type Deal, DealsService } from './deals.service.js';

@Controller('deals')
export class DealsController {
  constructor(@Inject(DealsService) private readonly deals: DealsService) {}

  @Get(':id')
  find(@Param('id') id: string): Promise<Deal> {
    return toHttp(this.deals.find(id), { DealNotFound: 404 });
  }

  @Post(':id/close')
  @MapErrors({ DealNotFound: 404, DealAlreadyClosed: 409 })
  close(@Param('id') id: string): Result<Deal, DealNotFound | DealAlreadyClosed> {
    return this.deals.close(id);
  }
}
```

`examples/deals-api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ResultModule } from 'nest-result';
import { DealsController } from './deals/deals.controller.js';
import { DealsService } from './deals/deals.service.js';

@Module({
  imports: [ResultModule.forRoot()],
  controllers: [DealsController],
  providers: [DealsService],
})
export class AppModule {}
```

`examples/deals-api/src/main.ts`:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
await app.listen(process.env['PORT'] ?? 3000);
```

- [ ] **Step 3: Add the root script that builds the example against the packed tarball**

Add to root `package.json` `scripts`:

```json
"example:build": "npm run build && rm -f examples/deals-api/nest-result-*.tgz && npm pack --pack-destination examples/deals-api && cd examples/deals-api && npm install && npm install --no-save ./nest-result-*.tgz && npm run build"
```

- [ ] **Step 4: Build and exercise the example**

Run: `npm run example:build`, then in a second terminal start it with `npm --prefix examples/deals-api start`, then run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/deals/1
curl -s localhost:3000/deals/9
curl -s -X POST -o /dev/null -w "%{http_code}\n" localhost:3000/deals/1/close
curl -s -X POST localhost:3000/deals/2/close
```

Expected, in order: `200`; `{"statusCode":404,"code":"DealNotFound","message":"Deal 9 does not exist"}`; `201`; `{"statusCode":409,"code":"DealAlreadyClosed","message":"Deal 2 is already closed"}`. Stop the server afterwards.

- [ ] **Step 5: Write `README.md`**

````md
# nest-result

Return typed errors from your NestJS handlers and let the compiler prove every one of them is mapped to an HTTP response.

Built on [neverthrow](https://github.com/supermacro/neverthrow). Works with Express and Fastify, NestJS 11 and 12.

**Status: pre-1.0 (`0.0.0`).** The public API may still change between versions.

```bash
npm install nest-result neverthrow
```

## In 60 seconds

```ts
import { TaggedError, MapErrors, ResultModule } from 'nest-result';
import { err, ok, type Result } from 'neverthrow';

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
export class DealAlreadyClosed extends TaggedError('DealAlreadyClosed') {}

@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Post(':id/close')
  @MapErrors({ DealNotFound: 404, DealAlreadyClosed: 409 })
  close(@Param('id') id: string): Result<Deal, DealNotFound | DealAlreadyClosed> {
    return this.deals.close(id);
  }
}

@Module({ imports: [ResultModule.forRoot()], controllers: [DealsController], providers: [DealsService] })
export class AppModule {}
```

An `Ok` becomes the response body. An `Err` becomes its mapped status with this body:

```json
{ "statusCode": 409, "code": "DealAlreadyClosed", "message": "DealAlreadyClosed" }
```

Now add a third error to the service's return type and forget to map it. The build fails:

```
error TS1241: Unable to resolve signature of method decorator when called as an expression.
  ...
    Property '__missingErrorMapKeys' is missing in type ... but required in type 'MissingErrorMapKeys<"DealLocked">'.
```

Map a tag that can no longer happen and you get `StaleErrorMapKeys<"...">`. Return a plain `Error` and you get `UntaggedErrorsCannotBeMapped<Error>`.

## Tagged errors

Any value with a literal `_tag` is a tagged error. `TaggedError` is a convenience, not a requirement:

```ts
class RateLimited extends TaggedError('RateLimited')<{ retryAfter: number; message: string }> {}
const plain = { _tag: 'RateLimited' } as const;
```

`TaggedError` instances are real `Error`s with a stack trace, `name` equal to the tag, and `message` defaulting to the tag. Payloads may not declare `_tag` or `name`.

The error's own fields are never sent to the client unless you ask for them with a custom body.

## Mapping errors

### In the controller body: `toHttp`

```ts
@Get(':id')
find(@Param('id') id: string): Promise<Deal> {
  return toHttp(this.deals.find(id), { DealNotFound: 404 });
}
```

`toHttp` accepts a `Result`, `ResultAsync` or `Promise<Result>`. An `Err` is thrown as a regular `HttpException`, so your existing exception filters keep working.

### As a decorator: `MapErrors`

`MapErrors` checks the method's return type against the map and converts the Result in a route-level interceptor. Because it runs innermost, global interceptors such as `ClassSerializerInterceptor` see the unwrapped value.

### Custom bodies

```ts
@MapErrors({
  DealNotFound: { status: 404, body: (e: DealNotFound) => ({ dealId: e.dealId }) },
  DealAlreadyClosed: 409,
})
```

With `toHttp` the parameter type is inferred. With `MapErrors` annotate it; the annotation is checked against the method's actual error type.

### The safety net: `ResultModule`

`ResultModule.forRoot()` registers a global interceptor. A route that returns a Result without `MapErrors` fails with 500 and a logged `MissingErrorMapError` instead of leaking `{ "value": ... }` to the client. A Result from a second copy of neverthrow in your dependency tree fails the same way with `DuplicateNeverthrowError`.

## Swagger

```ts
import { MapErrors } from 'nest-result/swagger';
```

Same decorator, plus one `@ApiResponse` per mapped status, listing the tags that share it. Requires `@nestjs/swagger`.

## Transactions that roll back on Err

With [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional), a transaction rolls back when the method throws. A method that returns `Err` does not throw, so its partial writes are committed. `nest-result/transactional` fixes that for every adapter (TypeORM, Prisma, Drizzle, Knex, MikroORM, Kysely):

```ts
import { TransactionalResult } from 'nest-result/transactional';

@Injectable()
export class DealsService {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  @TransactionalResult()
  async close(id: string): Promise<Result<Deal, DealNotFound | DealAlreadyClosed>> {
    await this.txHost.tx.getRepository(DealEntity).update(id, { closed: true });
    return err(new DealAlreadyClosed());
  }
}
```

`Ok` commits, `Err` rolls back and is returned unchanged, and a thrown exception rolls back and is rethrown. `@TransactionalResult` takes the same arguments as `@Transactional` and requires the method to return `Promise<Result>`. For the `ResultAsync` style, use the function form:

```ts
withResultTransaction(this.txHost, () => this.repository.close(id), { propagation: Propagation.RequiresNew });
```

### Nested transactions

With the default `Required` propagation, an inner method joins the outer transaction and its `Err` is returned to the outer method as a value. The outer method decides:

- if it returns `Err` too, everything rolls back;
- if it recovers and returns `Ok`, everything commits, including the inner method's writes made before it failed.

To discard the inner work independently, use `Propagation.Nested` (a savepoint) or `Propagation.RequiresNew`.

## Migrating from a hand-rolled interceptor

1. Replace your error base class with `TaggedError(...)` subclasses, or add a literal `readonly _tag` to existing errors.
2. Add `ResultModule.forRoot()` to your root module and delete your interceptor.
3. Add `@MapErrors({...})` to each route that returns a Result; the compiler lists every tag you still need to map.
4. Remove `HttpException`s from your domain code; map domain errors at the controller instead.

## Requirements

Node 22.12+, TypeScript 5.5+, `experimentalDecorators`, NestJS 11 or 12, neverthrow 8.

A CommonJS host on NestJS 12 needs a TypeScript version and `moduleResolution` that understand `require` of ES modules: TypeScript 5.8+ with `module: nodenext`. Older combinations report TS1479 on NestJS's own imports before they reach this package.

## Example

`examples/deals-api` is a runnable app. Build it against the packed package with `npm run example:build`, then start it with `npm --prefix examples/deals-api start`.

## License

MIT
````

- [ ] **Step 6: Verify the README's claims against the code**

Run: `npm run check && npm run test:diagnostics-snapshot`
Expected: both exit 0. Confirm the error output quoted in the README appears in the snapshot file for `decorator-missing-key` (`MissingErrorMapKeys<"...">`). If the README's code differs from the real API in any name or argument, fix the README.

- [ ] **Step 7: Commit**

```bash
git add README.md examples package.json
git commit -m "add readme and example app"
```

---

## After the plan

These are the author's decisions and are not part of any task:
- choosing the final npm name (`nest-result` was free on 2026-09-30);
- creating the GitHub repository under the personal `mannkostir` account and pushing with plain `git`;
- configuring npm trusted publishing for the repository's `publish.yml`, then following the Releasing steps in `CLAUDE.md` for `0.1.0`.

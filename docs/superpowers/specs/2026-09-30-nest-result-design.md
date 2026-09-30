# nest-result — Design Spec

Date: 2026-09-30
Status: Draft, awaiting review

## 1. Purpose

An open-source NestJS integration for `neverthrow` Results that lets handlers return typed, tagged errors and guarantees, at compile time, that every error a controller can produce is mapped to an HTTP response. It also makes transactions roll back when a Result is `Err`, not only when an exception is thrown.

### 1.1 Problem

NestJS projects that adopt Result types (147 public repositories list both `@nestjs/core` and `neverthrow`) hand-roll the same glue: a small interceptor that unwraps Results, ad-hoc `if (result.isErr())` blocks in controllers, and HTTP exceptions leaking into domain code. Existing transaction tooling (`@nestjs-cls/transactional`, TypeORM `transaction()`) rolls back only on throw, so Result-returning code silently commits partial writes when it returns `Err`.

No maintained package covers this. The closest, `@startupdevhouse/typescript-functional-extensions-nestjs`, targets a different Result library, has no exhaustiveness checking, was last released in 2023 and has about 4 weekly downloads.

### 1.2 Goal and success criteria

The goal is real adoption by NestJS developers outside the author's own projects.

v1 succeeds when:
- a developer can go from install to a working, exhaustively-mapped endpoint using only the README;
- forgetting to map a new error, or keeping a stale mapping, fails compilation with a message a developer can act on without reading library source;
- a Result-returning service method wrapped in a transaction rolls back on `Err` with every `@nestjs-cls/transactional` adapter;
- the hand-rolled Result glue in a codebase like humart-backend could be replaced by the package.

### 1.3 Non-goals for v1

- A Result implementation of its own. `neverthrow` is a peer dependency.
- GraphQL and microservice transports.
- Typed CQRS integration.
- Global default error mappings.
- Domain events, aggregate tracking, correlation locks, or any unit-of-work abstraction.
- Spring-style rollback-only marking for nested transactions.

## 2. Decisions

| Topic | Decision |
|---|---|
| Result core | `neverthrow` ^8 as a peer dependency |
| Error identity | A literal `readonly _tag` property, structural; `TaggedError` helper provided but optional |
| Transports | HTTP only, on Express and Fastify; core kept transport-agnostic |
| v1 scope | Core, HTTP mapping, Swagger integration, Result-aware transactions |
| API style | Pure functions as the core, decorators as thin wrappers over them |
| Nested transactions | The outer caller decides; no rollback-only marking |
| Package shape | One package, `nest-result`, with subpath entry points |

The npm name `nest-result` was unregistered on 2026-09-30. It may be changed before first publish.

## 3. Package layout

### 3.1 Entry points

| Import path | Contents | Extra peer dependencies |
|---|---|---|
| `nest-result` | `TaggedError`, tag and error-map types, `toHttp`, `MapErrors`, `ResultInterceptor`, `ResultModule` | none |
| `nest-result/swagger` | `MapErrors` that also emits `@ApiResponse` metadata | `@nestjs/swagger` |
| `nest-result/transactional` | `withResultTransaction`, `TransactionalResult` | `nestjs-cls`, `@nestjs-cls/transactional` |

Required peer dependencies: `neverthrow` ^8, `@nestjs/common` and `@nestjs/core` ^11 || ^12, `rxjs` ^7, `reflect-metadata`. Consumers need Node 22 or later and TypeScript 5.5 or later. NestJS 12 is ESM-only and NestJS 11 is CommonJS, so both module formats are shipped. The `nest-result` and `nest-result/swagger` entry points have a single ESM implementation, and their CommonJS files load it through `require(esm)`, so CommonJS and ESM hosts share one copy of every class. `nest-result/transactional` ships a real CommonJS build, because `nestjs-cls` and `@nestjs-cls/transactional` have separate ESM and CJS copies and the host's plugin registration lives in the copy that matches its module format; the transactional code shares no class identity with the other entry points, so a second copy of it is harmless. `@nestjs/swagger`, `nestjs-cls` and `@nestjs-cls/transactional` are optional peers and are imported only from their own entry points.

### 3.2 Source layers

```
src/core/            no Nest imports
src/http/            imports core
src/swagger/         imports core and http
src/transactional/   imports core
```

Dependencies point only toward `core`. `core` must be usable and testable without NestJS installed.

## 4. Core

### 4.1 Tagged errors

A tagged error is any value with a `readonly _tag` whose type is a string literal.

```ts
type Tagged = { readonly _tag: string };
type TagOf<E extends Tagged> = E['_tag'];
```

`TaggedError(tag)` returns a base class. Subclasses optionally declare a payload type whose fields are assigned onto the instance:

```ts
class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
class Unauthorized extends TaggedError('Unauthorized') {}

const e = new DealNotFound({ dealId: '42' });
```

Guarantees:
- `e._tag` has the literal type `'DealNotFound'`;
- `e.dealId` is typed from the payload;
- `e instanceof Error` and `e instanceof DealNotFound` are both true, `e.name` equals the tag, and a stack trace is captured;
- a payload-less error is constructed with no arguments;
- `message` defaults to the tag and may be set through an optional `message` field in the payload.

The payload type must be an object type (type literal or interface). It may not declare `_tag` or `name`, and a declared `message` must be a string; violations are compile errors. At runtime the tag and name are assigned after the payload, so a payload smuggled in through a cast cannot overwrite them.

Plain objects such as `{ _tag: 'RateLimited' as const }` are equally valid errors. The library never requires extending `TaggedError`.

### 4.2 Error maps

For an error union `E`, `ErrorMap<E>` is an object with exactly one key per tag in `E`:

```ts
type HttpErrorSpec<E> =
  | number
  | { readonly status: number; readonly body: (error: E) => object };

type ErrorMap<E extends Tagged> = {
  readonly [K in TagOf<E>]: HttpErrorSpec<Extract<E, { _tag: K }>>;
};
```

Exactness rules, all enforced at compile time where the map is supplied:
- a tag present in `E` and missing from the map is an error;
- a key present in the map and absent from `E` is an error;
- an `E` that includes a member without a literal `_tag` (for example plain `Error`, `string`, or `{ _tag: string }`) is an error;
- `E = never` requires an empty map.

### 4.3 Resolution

`resolveHttpError(error, map)` is a pure function returning `{ status, body }`.

The default body is:

```json
{ "statusCode": 404, "code": "DealNotFound", "message": "Deal not found" }
```

The error's own fields are not included unless an explicit `body` function is supplied. When `body` is supplied, its return value is the whole response body.

`resolveHttpError` returns `Result<HttpErrorResponse, UnmappedErrorTagError | UntaggedErrorValueError>`. Runtime failures, reachable only by bypassing the types (casts, `any`), are returned as these typed library errors rather than being silently mapped:
- `UnmappedErrorTagError` when the tag is not a key of the map;
- `UntaggedErrorValueError` when the value has no string `_tag`.

## 5. HTTP

### 5.1 `toHttp`

```ts
function toHttp<T, E extends Tagged>(
  source: Result<T, E> | ResultAsync<T, E> | Promise<Result<T, E>>,
  map: ErrorMap<E>,
): Promise<T>;
```

- `Ok(value)` resolves to `value` unchanged, so interceptors such as `ClassSerializerInterceptor` still apply.
- `Err(error)` rejects with a Nest `HttpException` carrying the resolved status and body, so existing exception filters and logging keep working on both Express and Fastify.
- The runtime failures from 4.3 are thrown as the typed library errors themselves. They are not `HttpException`s, so Nest's exception handler responds with 500 and logs them with their message and stack, which names the tag. The library contains no logging code of its own.

### 5.2 `MapErrors`

```ts
@Get(':id')
@MapErrors({ DealNotFound: 404, AccessDenied: 403 })
find(@Param('id') id: string): ResultAsync<Deal, DealNotFound | AccessDenied> {
  return this.deals.find(id);
}
```

- A method decorator whose typed property descriptor requires the method to return `Result<T, E>`, `ResultAsync<T, E>` or `Promise<Result<T, E>>`, with the supplied map satisfying `ErrorMap<E>` exactly.
- Stores the map as method metadata and attaches `ResultInterceptor` to the route. A route-level interceptor is the innermost one, so the Result is converted before any global interceptor, such as a global `ClassSerializerInterceptor`, sees the response.
- A decorator factory receives the map before it sees the method, so a custom `body` function in the decorator form must annotate its parameter type (`body: (e: DealNotFound) => ...`). The annotation is checked against the method's actual error type. `toHttp` infers the parameter type without an annotation.

### 5.3 `ResultInterceptor` and `ResultModule`

`ResultModule.forRoot()` registers `ResultInterceptor` as a global interceptor through `APP_INTERCEPTOR`. In that position it is a safety net: routes decorated with `MapErrors` have already converted their Result at route level, so the global instance only ever sees Results from routes that lack `MapErrors`.

For each handler return value:
- a non-Result value passes through untouched;
- a Result or `ResultAsync` on a method with `MapErrors` metadata is converted with the same code path as `toHttp`;
- a Result on a method without `MapErrors` metadata throws `MissingErrorMapError`, naming the controller class and method; Nest responds with 500 and logs it.

Result detection uses `instanceof` against `Ok`, `Err` and `ResultAsync` imported from the `neverthrow` peer, so there is a single class identity. If a return value fails those checks but is Result-shaped (it has callable `isOk` and `isErr`, or is a thenable with `andThen` and `mapErr`), the interceptor treats it as a sign of duplicate `neverthrow` copies: it throws `DuplicateNeverthrowError`, naming the handler and the likely cause; Nest responds with 500 and logs it.

## 6. Swagger

`nest-result/swagger` exports a `MapErrors` with the identical signature. It applies the core `MapErrors` plus one `@ApiResponse({ status, description })` per distinct status in the map. The description lists the tags mapped to that status. When a spec has a custom `body`, the response schema is left unspecified in v1.

## 7. Transactions

### 7.1 `withResultTransaction`

```ts
function withResultTransaction<T, E>(
  txHost: TransactionHost,
  fn: () => Promise<Result<T, E>> | ResultAsync<T, E>,
  options?: WithTransactionOptions,
): ResultAsync<T, E>;
```

`options` mirrors what `TransactionHost.withTransaction` accepts: propagation and adapter-specific transaction options.

Behaviour:
1. Calls `txHost.withTransaction` with the given options and a callback that awaits `fn()`.
2. If the result is `Ok`, the callback returns it and the adapter commits.
3. If the result is `Err`, the callback throws a `RollbackSignal` that holds that `Err`, and the adapter rolls back.
4. The wrapper catches only the `RollbackSignal` instance it created and resolves to the held `Err`.
5. Any other exception thrown by `fn` propagates unchanged after the adapter's normal rollback.

`RollbackSignal` is internal and not exported. It is thrown after `fn` has completed, outside user code, so user code cannot observe it.

### 7.2 `TransactionalResult`

A method decorator accepting the same argument forms as `@Transactional` from `@nestjs-cls/transactional`: `()`, `(propagation)`, `(options)`, `(propagation, options)` and `(connectionName, propagation?, options?)`. The method must return `Promise<Result<T, E>>`, which is enforced by the typed descriptor, and the decorated method returns a real `Promise`. Methods written in the `ResultAsync` style use `withResultTransaction` directly, because the decorator cannot know before the method runs which of the two shapes the caller expects. It wraps the method body with `withResultTransaction`, locating the `TransactionHost` through `TransactionHost.getInstance(connectionName)`, exactly as `@Transactional` does, and copies method metadata with `copyMethodMetadata` from `nestjs-cls` so other decorators on the same method keep working.

### 7.3 Nested transactions

With the default `Required` propagation, an inner `TransactionalResult` joins the outer transaction. If it returns `Err`, the `Err` reaches the outer function as an ordinary value:
- if the outer function returns `Err`, the whole transaction rolls back;
- if the outer function recovers and returns `Ok`, the whole transaction commits, including writes made by the inner function before it failed.

Callers that need the inner work discarded independently use `Propagation.Nested` (savepoint) or `Propagation.RequiresNew`. The rollback signal rolls back that savepoint or inner transaction through the adapter's normal throw handling. The documentation states this behaviour prominently.

### 7.4 Setup errors

If `nestjs-cls` or the transactional plugin is not configured, the plugin's own error surfaces on first use. The library does not wrap or hide it.

## 8. Testing

1. **Unit tests** (vitest) for `core` and for `withResultTransaction` against a fake transactional adapter: status and body resolution, default body shape, runtime failure errors, commit on `Ok`, rollback on `Err`, rethrow on exception, and signal isolation.
2. **Type tests** (vitest `expectTypeOf` and `@ts-expect-error`) for missing keys, extra keys, untagged errors, `never` error unions, payload typing on `TaggedError`, return-type enforcement on both decorators, and type preservation through `toHttp` and `withResultTransaction`.
3. **Compiler-diagnostic snapshots**: fixture files containing the common mistakes are compiled with `tsc`, and the diagnostic text is snapshotted. This measures and guards the readability of the errors developers will actually see.
4. **Integration tests** with `@nestjs/testing` and supertest on both Express and Fastify, covering `toHttp`, `MapErrors` with `ResultModule`, a missing-metadata 500, compatibility with an existing exception filter, and Swagger document output. Transaction integration tests run against in-memory SQLite through the TypeORM adapter for `@nestjs-cls/transactional`, including `Propagation.Nested` savepoint rollback and the nested recover-and-commit case from 7.3.

CI matrix: NestJS 11 and 12 and neverthrow 8; the full suite runs on Node 24. The Node 22.12.0 floor is verified by the `load` job's build and package tests, which include the CommonJS-host transactional test. Type tests and diagnostic checks run against TypeScript 5.5, 6 and 7 through the `tsc` command-line tool. The repository itself builds with TypeScript 6, because TypeScript 7 has no JavaScript compiler API and the declaration bundler and package linter depend on it.

## 9. Tooling, release and docs

- TypeScript strict mode; ESM and CJS builds with tsup and an `exports` map covering the three entry points; type declarations for both formats.
- Code style follows the author's standards, including no comments; `@ts-expect-error` in type tests is the only directive used.
- MIT licence; releases follow the author's `nestjs-kafka` flow: a version-bump PR (`prepare <version>`), a GitHub Release `v<version>`, and a guarded `publish.yml` that stages the package through npm trusted publishing with provenance; releases start at `0.1.0`.
- README opens with a 60-second example: a tagged error, a service, a controller with `MapErrors`, and the compile error produced by a missing mapping. Recipes follow for Swagger, transactions, nested propagation, and migrating from a hand-rolled interceptor.
- A runnable example application in `examples/`.

## 10. Build order

1. **Spike (go/no-go).** Prototype `MapErrors` exactness through a typed method descriptor and capture the `tsc` messages for a missing key, an extra key, and an untagged error. Confirm how `@Transactional` locates `TransactionHost`, and that the typed-descriptor approach works under the decorator settings NestJS requires. If the decorator diagnostics are not actionable, stop and revisit the decorator API before continuing; the function API remains viable either way.
2. Core: `TaggedError`, types, `resolveHttpError`.
3. HTTP: `toHttp`, `MapErrors`, `ResultInterceptor`, `ResultModule`.
4. Swagger entry point.
5. Transactional entry point.
6. Docs, example app, CI matrix, release pipeline.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Decorator type errors are unreadable | Spike first; diagnostic snapshot tests; function API does not depend on decorators |
| Small audience | Accepted; scope kept small and polished |
| neverthrow release pace slows | Peer dependency keeps coupling to a narrow API surface: `Ok`, `Err`, `ResultAsync`, `isOk`, `isErr` |
| Duplicate neverthrow copies break `instanceof` | Result-shaped values that fail `instanceof` throw `DuplicateNeverthrowError`, which Nest turns into a 500 and a logged error naming the cause |
| `@nestjs-cls/transactional` internals change | Depend only on its public `TransactionHost.withTransaction` and decorator conventions; cover with integration tests in the CI matrix |

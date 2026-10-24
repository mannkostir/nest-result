# nest-result

Return typed errors from your NestJS handlers and let the compiler prove every one of them is mapped to an HTTP response.

Built on [neverthrow](https://github.com/supermacro/neverthrow). Works with Express and Fastify, NestJS 11 and 12.

**Status: pre-1.0 (`0.3.0`).** The public API may still change between versions.

```bash
npm install nest-result neverthrow
```

## In 60 seconds

```ts
import { Controller, Injectable, Module, Param, Post } from '@nestjs/common';
import { TaggedError, MapErrors, ResultModule } from 'nest-result';
import { err, ok, type Result } from 'neverthrow';

export type Deal = { id: string; closed: boolean };

export class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}
export class DealAlreadyClosed extends TaggedError('DealAlreadyClosed') {}

@Injectable()
export class DealsService {
  private readonly deals = new Map<string, Deal>([['1', { id: '1', closed: false }]]);

  close(id: string): Result<Deal, DealNotFound | DealAlreadyClosed> {
    const deal = this.deals.get(id);
    if (deal === undefined) return err(new DealNotFound({ dealId: id }));
    if (deal.closed) return err(new DealAlreadyClosed());
    return ok({ ...deal, closed: true });
  }
}

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

`toHttp` reports the same markers, except that a body function with a too-narrow parameter is reported by TypeScript directly.

## Tagged errors

Any value with a literal `_tag` is a tagged error. `TaggedError` is a convenience, not a requirement:

```ts
class RateLimited extends TaggedError('RateLimited')<{ retryAfter: number; message: string }> {}
const plain = { _tag: 'RateLimited' } as const;
```

`TaggedError` instances are real `Error`s with a stack trace, `name` equal to the tag, and `message` defaulting to the tag. A payload `cause` becomes the standard `Error.cause`, and its declared type is not kept on the instance: `error.cause` is `unknown`. Payloads may not declare `_tag`, `_family`, `name` or `stack`. `JSON.stringify` of an error contains its `_tag`, its `_family` and its payload fields, nothing else.

The default error body is `statusCode`, `code` (the tag) and `message`. No other payload field is ever sent to the client. `message` is sent as-is, so for internal failures use a fixed message or a custom `body` rather than passing through driver or exception text.

### Families

An error may belong to one family. A map key can be a tag or a family:

```ts
class DealNotFound extends TaggedError('DealNotFound', { family: 'NotFound' })<{ dealId: string }> {}
class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' }) {}

@MapErrors({ NotFound: 404, DealArchived: 410 })
```

A tag key wins over its family key. Every error must still be covered by its tag or its family, so a new `NotFound` error needs no route change, while a new family fails compilation until it is mapped. A family key that every member overrides is reported as stale, and a name used as a tag by one error and a family by another is reported as `AmbiguousErrorKeys<"...">`. A plain object joins a family with `_family`: `{ _tag: 'RateLimited', _family: 'Throttled' } as const`.

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

`MapErrors` checks the method's return type against the map and converts the Result in a route-level interceptor. That interceptor runs inside global and controller-level interceptors, so they, `ClassSerializerInterceptor` included, see the unwrapped value.

Method-level interceptors must be declared below `@MapErrors`:

```ts
@Get(':id')
@MapErrors({ DealNotFound: 404 })
@UseInterceptors(ClassSerializerInterceptor)
find(@Param('id') id: string): Result<Deal, DealNotFound> {
  return this.deals.find(id);
}
```

Declared above it, they would see the Result itself, so the request fails with 500 and a logged `ResultInterceptorOrderError` before the handler runs.

### Custom bodies

```ts
@MapErrors({
  DealNotFound: { status: 404, body: (e: DealNotFound) => ({ dealId: e.dealId }) },
  DealAlreadyClosed: 409,
})
```

With `toHttp` the parameter type is inferred. With `MapErrors` annotate it; the annotation is checked against the method's actual error type. A body on a family key receives every member of that family.

### Shared defaults

```ts
export const domainDefaults = errorDefaults({ NotFound: 404, Conflict: 409, NotPermitted: 403 });
export const MapDomainErrors = MapErrors.withDefaults(domainDefaults);

@Get(':id')
@MapDomainErrors({ DealArchived: 410 })
find(@Param('id') id: string): ResultAsync<Deal, DealNotFound | DealArchived> {
  return this.deals.find(id);
}
```

Default keys count toward coverage but are never reported as stale, so one set of defaults serves every route. Route keys win over defaults. `toHttp(result, { DealArchived: 410 }, domainDefaults)` works the same way.

### Problem details

```ts
export const domainDefaults = errorDefaults({ NotFound: 404, Conflict: 409 }, { body: 'problem-details' });
```

Every status-only entry of a route using these defaults, route keys included, then responds with an RFC 9457 problem details body:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Deal not found",
  "code": "DealNotFound",
  "instance": "/deals/1"
}
```

`title` is the IANA reason phrase of the status; an unregistered code takes the phrase of its class's x00 code. `instance` is the request path without the query string. Payload fields are never included. This applies through `MapErrors.withDefaults`, the Swagger `MapErrors.withDefaults` and `toHttp(source, map, defaults)`; `MapErrors(map)` and `toHttp` without defaults keep the default body.

The interceptor sends the body as `application/problem+json`. On Nest 11 with Express, Nest's exception reply resets that type: the problem body goes out as `application/json` and Nest logs a warning. Nest 12, and Fastify on either version, keep it. The interceptor sets that header when it maps the Err, so an exception filter that rewrites the body should also set its own content type. `toHttp` cannot set headers: its problem body, without `instance`, goes out as `application/json`. Custom `body` functions are sent as-is, as `application/json`.

### Statuses

Error statuses must be literal integers from 400 to 599. `{ DealNotFound: 200 }` or a status typed as `number` fails compilation with `ErrorStatusOutOfRange<...>`, and a status smuggled in through a cast throws `InvalidErrorStatusError` when the map is built.

### No content

`@HttpCode(204)` composes with `MapErrors`: a route returning `Ok(undefined)` responds 204 with an empty body.

### The safety net: `ResultModule`

`ResultModule.forRoot()` registers a global interceptor. A route that returns a Result without `MapErrors` fails with 500 and a logged `MissingErrorMapError` instead of leaking `{ "value": ... }` to the client. A Result from a second copy of neverthrow in your dependency tree fails the same way with `DuplicateNeverthrowError`.

## Swagger

```ts
import { MapErrors } from 'nest-result/swagger';
```

Same decorator, plus one `@ApiResponse` per mapped status, listing the tags that share it, with a response schema. Requires `@nestjs/swagger`.

The default body is documented as `statusCode`, `code` and `message`, where `code` is an enum of the tags at that status that use the default body and have no `schemas` entry, with one example per tag.

With problem details defaults, every status-only entry of the route is documented under `application/problem+json`: as `type`, `title`, `status`, `detail`, `code` and an optional `instance`, with one example per tag, or as its `schemas` entry. Custom bodies stay under `application/json`, so a status with both lists both media types.

With shared defaults, name the defaults the route actually uses, so the document lists only responses the route can produce:

```ts
import { MapErrors } from 'nest-result/swagger';

const DocumentedDomainErrors = MapErrors.withDefaults(domainDefaults);

@DocumentedDomainErrors({ DealArchived: 410 }, { uses: ['NotFound'], families: ['NotFound'] })
```

The list is checked exactly: a used default missing from it is `MissingDefaultUses<"...">`, and a listed default the route cannot produce is `StaleDefaultUses<"...">`.

### Family keys

List the family keys the route uses, from its map or its used defaults, in `families`. Their status documents `code` as a plain string, because the runtime code is the member's tag, and the description marks the key `(family)`. The list is checked exactly: a family key in use missing from it is `MissingFamilyKeys<"...">`, and a listed name that is not a family key in use is `StaleFamilyKeys<"...">`.

### Custom body schemas

A custom body is documented through `schemas`, keyed by map key or `uses` key, with a DTO class or a `SchemaObject`:

```ts
@MapErrors(
  { DealNotFound: 404, RateLimited: { status: 429, body: (e: RateLimited) => ({ retryAfter: e.retryAfter }) } },
  { schemas: { RateLimited: RetryDto } },
)
```

A custom body without a `schemas` entry leaves its status without a schema. Several bodies at one status are documented as `oneOf`.

## Matching errors without HTTP

`matchError` applies the same exhaustiveness rules anywhere: message handlers, sagas, CLI commands.

```ts
import { matchError } from 'nest-result';

@EventPattern('payment.requested')
async handle(@Payload() command: MakePayment): Promise<void> {
  const result = await this.payments.make(command);
  if (result.isErr()) {
    matchError(result.error, {
      NotFound: (error) => this.logger.warn(error.message),
      PaymentDeclined: (error) => this.retries.schedule(error.paymentId),
    });
  }
}
```

A missing handler is `MissingErrorHandlers<"...">`, a handler for an error that cannot occur is `StaleErrorHandlers<"...">`. To act on several Results at once, combine them with neverthrow first:

```ts
const outcome = Result.combineWithAllErrors(await Promise.all(handlers.map((handler) => handler.handle(event))));
outcome.mapErr((errors) => errors.map((error) => matchError(error, { NotFound: () => 'skip', Conflict: () => 'retry' })));
```

## Transactions that roll back on Err

With [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional), a transaction rolls back when the method throws. A method that returns `Err` does not throw, so its partial writes are committed. `nest-result/transactional` fixes that. It works with any adapter, because it relies only on `@nestjs-cls/transactional`'s rollback-on-throw, and it is tested against TypeORM:

```ts
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { TransactionalResult } from 'nest-result/transactional';
import { err, type Result } from 'neverthrow';
import { DealEntity } from './deal.entity';
import { type Deal, DealAlreadyClosed, DealNotFound } from './deals';

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

## Transactions with typeorm-unit-of-work

[`typeorm-unit-of-work`](https://github.com/mannkostir/typeorm-unit-of-work) commits a unit whose work returns `Err`, including its domain events and outbox rows. `nest-result/unit-of-work` rolls it back instead:

```ts
import { withResultUnitOfWork } from 'nest-result/unit-of-work';

close(id: string): ResultAsync<Deal, DealNotFound | DealClosed> {
  return withResultUnitOfWork(this.uow, (tx) => this.deals.close(tx, id), { propagation: 'nested' });
}
```

`Ok` commits and publishes its events. `Err` rolls back, discards the pending events and resolves to the `Err`. An exception rolls back and propagates. With the default `join` propagation inside an outer unit, an inner `Err` reaches the outer function as a value, and if the outer function recovers, the inner writes and events commit with it; use `nested` to discard the inner work on its own. Requires `typeorm-unit-of-work` 0.1.1 or later.

## Migrating from a hand-rolled interceptor

1. Replace your error base class with `TaggedError(...)` subclasses, or add a literal `readonly _tag` to existing errors.
2. Add `ResultModule.forRoot()` to your root module and delete your interceptor.
3. Add `@MapErrors({...})` to each route that returns a Result; the compiler lists every tag you still need to map.
4. Remove `HttpException`s from your domain code; map domain errors at the controller instead.

## Migrating from 0.3

- Swagger `MapErrors` routes whose map or used defaults contain a family key must list it in `families`, otherwise compilation fails with `MissingFamilyKeys<"...">`. Tag-only routes, the core `MapErrors` and `toHttp` are unaffected.

## Migrating from 0.1

- `TaggedError`: `name` lives on the prototype and `message` and `cause` are no longer enumerable, so `JSON.stringify` and spreads of an error contain only `_tag`, `_family` and payload fields. A payload `cause` is now `Error.cause`, and its declared type is not kept on the instance, so `error.cause` is `unknown`. Payloads may no longer declare `stack` or `_family`.
- Statuses must be integers from 400 to 599. Maps typed with a wide `number` status no longer compile.
- `ErrorMap<E>` no longer requires every tag: it describes any valid map for `E`, keyed by tags or families. Annotating a reusable map with it loses exhaustiveness, so `toHttp` and `MapErrors` reject the value. Declare a reusable map with `as const satisfies ErrorMap<E>` to keep full checking at the use site:

```ts
const taskErrors = {
  NotFound: 404,
  AccessDenied: 403,
} as const satisfies ErrorMap<TaskNotFound | ProjectNotFound | AccessDenied>;
```
- A status outside 400 to 599 that reached a map through a cast now throws `InvalidErrorStatusError` when the map is built, which for `MapErrors` is at decoration time.
- Some compiler diagnostics changed: `toHttp` now reports the `MissingErrorMapKeys`, `StaleErrorMapKeys` and `UntaggedErrorsCannotBeMapped` markers, and `ErrorBodyParameterMismatch` names keys instead of the whole map.
- `UnmappedErrorTagError` and `UntaggedErrorValueError` messages no longer mention HTTP.

## Testing with Jest

A CommonJS Jest setup, the NestJS 11 default, loads the package without extra configuration. Earlier releases needed `--experimental-vm-modules`; it can be removed.

## Requirements

Node 22.12+, TypeScript 5.5+, `experimentalDecorators`, NestJS 11 or 12, neverthrow 8.

`nest-result/unit-of-work` needs `typeorm-unit-of-work` 0.1.1 or later, below 2.0.

A CommonJS host on NestJS 12 needs a TypeScript version and `moduleResolution` that understand `require` of ES modules: TypeScript 5.8+ with `module: nodenext`. Older combinations report TS1479 on NestJS's own imports before they reach this package.

On Node 22.12 a NestJS 12 host prints an `ExperimentalWarning` when it loads `nest-result` or `nest-result/swagger`, because the package's CommonJS build `require()`s NestJS 12's ES modules. The warning is harmless, and later Node 22 releases do not print it.

The implementation of `nest-result`, `nest-result/swagger` and `nest-result/unit-of-work` is CommonJS, and their ES module entry points re-export it. A bundler that emits ES modules with the peers left external therefore keeps their `require()` calls, which fail at load with `Dynamic require of "@nestjs/common" is not supported`. Emit CommonJS, or define `require` in a banner. With esbuild:

```bash
esbuild src/main.ts --bundle --platform=node --format=esm \
  '--external:@nestjs/*' --external:neverthrow --external:rxjs --external:reflect-metadata \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
```

## Example

`examples/deals-api` is a runnable app. Build it against the packed package with `npm run example:build`, then start it with `npm --prefix examples/deals-api start`.

## License

MIT

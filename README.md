# nest-result

Return typed errors from your NestJS handlers and let the compiler prove every one of them is mapped to an HTTP response.

Built on [neverthrow](https://github.com/supermacro/neverthrow). Works with Express and Fastify, NestJS 11 and 12.

**Status: pre-1.0 (`0.1.0`).** The public API may still change between versions.

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

With `toHttp` a missing key shows as TypeScript's own `Property 'DealLocked' is missing in type ... but required in type ...` error instead of `MissingErrorMapKeys<...>`.

## Tagged errors

Any value with a literal `_tag` is a tagged error. `TaggedError` is a convenience, not a requirement:

```ts
class RateLimited extends TaggedError('RateLimited')<{ retryAfter: number; message: string }> {}
const plain = { _tag: 'RateLimited' } as const;
```

`TaggedError` instances are real `Error`s with a stack trace, `name` equal to the tag, and `message` defaulting to the tag. Payloads may not declare `_tag` or `name`.

The default error body is `statusCode`, `code` (the tag) and `message`. No other payload field is ever sent to the client. `message` is sent as-is, so for internal failures use a fixed message or a custom `body` rather than passing through driver or exception text.

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

## Migrating from a hand-rolled interceptor

1. Replace your error base class with `TaggedError(...)` subclasses, or add a literal `readonly _tag` to existing errors.
2. Add `ResultModule.forRoot()` to your root module and delete your interceptor.
3. Add `@MapErrors({...})` to each route that returns a Result; the compiler lists every tag you still need to map.
4. Remove `HttpException`s from your domain code; map domain errors at the controller instead.

## Testing with Jest

The package's implementation is ES modules. A CommonJS Jest setup, the NestJS 11 default, cannot `require` it unless Jest runs with Node's VM modules support. Start Jest through Node with the flag:

```json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  }
}
```

## Requirements

Node 22.12+, TypeScript 5.5+, `experimentalDecorators`, NestJS 11 or 12, neverthrow 8.

A CommonJS host on NestJS 12 needs a TypeScript version and `moduleResolution` that understand `require` of ES modules: TypeScript 5.8+ with `module: nodenext`. Older combinations report TS1479 on NestJS's own imports before they reach this package.

On Node 22.12 a CommonJS host prints an `ExperimentalWarning` when it loads the package, because the CommonJS entry points `require()` the ES module build. The warning is harmless.

## Example

`examples/deals-api` is a runnable app. Build it against the packed package with `npm run example:build`, then start it with `npm --prefix examples/deals-api start`.

## License

MIT

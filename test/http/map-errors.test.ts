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

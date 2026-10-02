import { Controller, Get, HttpException, type INestApplication, Param } from '@nestjs/common';
import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  errorDefaults,
  InvalidErrorStatusError,
  TaggedError,
  toHttp,
  UnmappedErrorTagError,
  UntaggedErrorValueError,
} from '../../src/index.js';
import { createApp, platforms } from '../support/create-app.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string; message: string }> {}
class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' }) {}

const notFound = () => new DealNotFound({ dealId: '9', message: 'Deal not found' });

async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return pending.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
}

describe('toHttp', () => {
  it('rejects with the status of a shared default', async () => {
    const failed: ResultAsync<number, TaskNotFound> = errAsync(new TaskNotFound());
    const thrown = await rejectionOf(toHttp(failed, {}, errorDefaults({ NotFound: 404 })));
    expect((thrown as HttpException).getStatus()).toBe(404);
  });

  it('propagates a rejected ResultAsync unchanged', async () => {
    const boom = new Error('boom');
    const rejected = new ResultAsync<number, DealNotFound>(Promise.reject(boom));
    await expect(toHttp(rejected, { DealNotFound: 404 })).rejects.toBe(boom);
  });

  it('rejects with InvalidErrorStatusError when a cast smuggles in a status outside 400–599', async () => {
    const map = { DealNotFound: 302 } as unknown as { DealNotFound: 404 };
    await expect(toHttp(err(notFound()), map)).rejects.toBeInstanceOf(InvalidErrorStatusError);
  });

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

  it('rejects with UntaggedErrorValueError when a cast hides an untagged error', async () => {
    const untagged = err({ reason: 'no tag' }) as unknown as Result<number, DealNotFound>;
    await expect(toHttp(untagged, { DealNotFound: 404 })).rejects.toBeInstanceOf(UntaggedErrorValueError);
  });

  it('rejects with an HttpException instance', async () => {
    await expect(toHttp(err(notFound()), { DealNotFound: 404 })).rejects.toBeInstanceOf(HttpException);
  });
});

@Controller('deals')
class DealsController {
  @Get(':id')
  find(@Param('id') id: string): Promise<{ id: string }> {
    const result: Result<{ id: string }, DealNotFound> =
      id === 'missing' ? err(new DealNotFound({ dealId: id, message: 'Deal not found' })) : ok({ id });
    return toHttp(result, { DealNotFound: 404 });
  }
}

describe.each(platforms)('toHttp in a controller on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, { controllers: [DealsController] });
    return request(app.getHttpServer());
  };

  it('responds with 200 and the Ok value', async () => {
    const response = await (await start()).get('/deals/7');
    expect({ status: response.status, body: response.body }).toEqual({ status: 200, body: { id: '7' } });
  });

  it('responds with the mapped status and default body for an Err', async () => {
    const response = await (await start()).get('/deals/missing');
    expect({ status: response.status, body: response.body }).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'DealNotFound', message: 'Deal not found' },
    });
  });
});

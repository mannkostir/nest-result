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

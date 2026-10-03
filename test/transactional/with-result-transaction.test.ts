import { Propagation, type TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { err, errAsync, ok, okAsync, type Result } from 'neverthrow';
import { describe, expect, it } from 'vitest';
import { TaggedError } from '../../src/index.js';
import { withResultTransaction } from '../../src/transactional/index.js';

class Rejected extends TaggedError('Rejected') {}

type RecordingHost = {
  readonly host: TransactionHost<TransactionalAdapterTypeOrm>;
  readonly outcomes: string[];
  readonly calls: unknown[][];
  readonly names: string[];
};

function recordingHost(): RecordingHost {
  const outcomes: string[] = [];
  const calls: unknown[][] = [];
  const names: string[] = [];
  const withTransaction = async (...args: unknown[]): Promise<unknown> => {
    calls.push(args.slice(0, -1));
    const fn = args.at(-1) as () => Promise<unknown>;
    names.push(fn.name);
    try {
      const value = await fn();
      outcomes.push('commit');
      return value;
    } catch (thrown) {
      outcomes.push('rollback');
      throw thrown;
    }
  };
  return {
    host: { withTransaction } as unknown as TransactionHost<TransactionalAdapterTypeOrm>,
    outcomes,
    calls,
    names,
  };
}

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
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

  it('keeps interleaved transactions isolated', async () => {
    const { host, outcomes } = recordingHost();
    const failing = deferred<Result<string, Rejected>>();
    const succeeding = deferred<Result<string, Rejected>>();
    const first = withResultTransaction(host, () => failing.promise);
    const second = withResultTransaction(host, () => succeeding.promise);
    succeeding.resolve(ok('fine'));
    failing.resolve(err(new Rejected()));
    const settled = await Promise.all([first, second]);
    expect({ results: settled.map((result) => result.isOk()), outcomes }).toEqual({
      results: [false, true],
      outcomes: ['commit', 'rollback'],
    });
  });

  it('passes propagation and options through to the transaction host', async () => {
    const { host, calls } = recordingHost();
    await withResultTransaction(host, () => okAsync(1), {
      propagation: Propagation.RequiresNew,
      options: { isolationLevel: 'SERIALIZABLE' },
    });
    expect(calls).toEqual([[Propagation.RequiresNew, { isolationLevel: 'SERIALIZABLE' }]]);
  });

  it('names the transaction callback after the wrapped function', async () => {
    const { host, names } = recordingHost();
    await withResultTransaction(host, function closeDeal() {
      return okAsync(1);
    });
    expect(names).toEqual(['closeDeal']);
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

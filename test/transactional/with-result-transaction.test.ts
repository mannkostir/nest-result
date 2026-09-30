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

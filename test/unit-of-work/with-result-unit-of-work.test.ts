import { err, ok, okAsync, type Result } from 'neverthrow';
import { DataSource, EntitySchema } from 'typeorm';
import { AggregateRoot, InProcessEventPublisher, type TransactionContext, UnitOfWork } from 'typeorm-unit-of-work';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaggedError } from '../../src/index.js';
import { type UnitOfWorkLike, withResultUnitOfWork } from '../../src/unit-of-work/index.js';

type DealRow = { id: number; title: string };

const DealSchema = new EntitySchema<DealRow>({
  name: 'deal',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    title: { type: String },
  },
});

class DealOpened {
  constructor(readonly title: string) {}
}

class Deal extends AggregateRoot {
  constructor(readonly title: string) {
    super();
    this.addDomainEvent(new DealOpened(title));
  }
}

class CreationRejected extends TaggedError('CreationRejected') {}

type Outcome = Promise<Result<void, CreationRejected>>;

describe('withResultUnitOfWork with typeorm-unit-of-work on SQLite', () => {
  let dataSource: DataSource;
  let uow: UnitOfWork;
  let published: readonly string[];

  beforeEach(async () => {
    dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: [DealSchema], synchronize: true });
    await dataSource.initialize();
    published = [];
    const publisher = new InProcessEventPublisher();
    publisher.onAfterCommit(DealOpened, (event) => {
      published = [...published, event.title];
    });
    uow = new UnitOfWork({
      dataSource,
      publisher,
      onAfterCommitError: (error) => {
        throw error;
      },
    });
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const open = async (tx: TransactionContext, title: string): Promise<void> => {
    await tx.getRepository(DealSchema).insert({ title });
    uow.track(new Deal(title));
  };

  const succeed = (title: string) =>
    withResultUnitOfWork(uow, async (tx): Outcome => {
      await open(tx, title);
      return ok(undefined);
    });

  const fail = (title: string, propagation?: 'join' | 'nested') =>
    withResultUnitOfWork(
      uow,
      async (tx): Outcome => {
        await open(tx, title);
        return err(new CreationRejected());
      },
      { propagation },
    );

  const outerRecovering = (propagation: 'join' | 'nested') =>
    withResultUnitOfWork(uow, async (tx): Outcome => {
      await open(tx, 'outer');
      const inner = await fail('inner', propagation);
      return inner.orElse(() => ok(undefined));
    });

  const titles = async () =>
    (await dataSource.getRepository(DealSchema).find({ order: { id: 'ASC' } })).map((row) => row.title);

  it('commits when the work returns Ok', async () => {
    await succeed('kept');
    expect(await titles()).toEqual(['kept']);
  });

  it('publishes the events of a committed Ok', async () => {
    await succeed('kept');
    expect(published).toEqual(['kept']);
  });

  it('rolls back when the work returns Err', async () => {
    await fail('discarded');
    expect(await titles()).toEqual([]);
  });

  it('publishes no events when the work returns Err', async () => {
    await fail('discarded');
    expect(published).toEqual([]);
  });

  it('returns the original Err after rolling back', async () => {
    const result = await fail('discarded');
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(CreationRejected);
  });

  it('rethrows an exception from the work unchanged', async () => {
    const boom = new Error('boom');
    const pending = withResultUnitOfWork(uow, async (): Outcome => {
      throw boom;
    });
    await expect(pending).rejects.toBe(boom);
  });

  it('rolls back when the work throws', async () => {
    const pending = withResultUnitOfWork(uow, async (tx): Outcome => {
      await open(tx, 'discarded');
      throw new Error('boom');
    });
    await pending.then(
      () => undefined,
      () => undefined,
    );
    expect(await titles()).toEqual([]);
  });

  it('rolls back only the savepoint when a nested inner unit returns Err', async () => {
    await outerRecovering('nested');
    expect(await titles()).toEqual(['outer']);
  });

  it('discards only the events of a nested inner unit that returns Err', async () => {
    await outerRecovering('nested');
    expect(published).toEqual(['outer']);
  });

  it('commits a joined inner write when the outer caller recovers from its Err', async () => {
    await outerRecovering('join');
    expect(await titles()).toEqual(['outer', 'inner']);
  });
});

describe('withResultUnitOfWork options', () => {
  it('passes the caller options through and adds its own commitWhen', async () => {
    const received: unknown[] = [];
    const recording: UnitOfWorkLike<string> = {
      run: async (work, options) => {
        received.push(options);
        return work('context');
      },
    };
    await withResultUnitOfWork(recording, () => okAsync(1), { propagation: 'nested', isolationLevel: 'SERIALIZABLE' });
    expect(received).toEqual([
      { propagation: 'nested', isolationLevel: 'SERIALIZABLE', commitWhen: expect.any(Function) },
    ]);
  });
});

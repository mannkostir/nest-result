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

  @Post('mapped-outside')
  @MapErrors({ CreationRejected: 409 })
  @TransactionalResult()
  async createMappedOutside(): Promise<Result<void, CreationRejected>> {
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

  it('keeps MapErrors working and rolls back when MapErrors is applied on top of TransactionalResult', async () => {
    const response = await request(app.getHttpServer()).post('/deals/mapped-outside');
    expect({ status: response.status, code: response.body.code, titles: await titles() }).toEqual({
      status: 409,
      code: 'CreationRejected',
      titles: [],
    });
  });

  it('returns a real Promise from the decorated method', async () => {
    const pending = app.get(DealWriter).insertThenSucceed('kept');
    expect(pending).toBeInstanceOf(Promise);
    await pending;
  });
});

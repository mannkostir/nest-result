import {
  type CallHandler,
  ClassSerializerInterceptor,
  Controller,
  type ExecutionContext,
  Get,
  type INestApplication,
  Inject,
  Injectable,
  type NestInterceptor,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { Exclude } from 'class-transformer';
import { err, ok, type Result } from 'neverthrow';
import { map, type Observable } from 'rxjs';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { MapErrors, ResultInterceptorOrderError, ResultModule } from '../../src/index.js';
import { createApp, platforms } from '../support/create-app.js';
import { DealNotFound } from '../support/errors.js';
import { ExceptionRecorder, recordingProviders } from '../support/exception-recorder.js';

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

@Injectable()
class DataWrappingInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<{ readonly data: unknown }> {
    return next.handle().pipe(map((data: unknown) => ({ data })));
  }
}

@Injectable()
class HandlerCallLog {
  private readonly entries: string[] = [];

  record(handler: string): void {
    this.entries.push(handler);
  }

  get calls(): readonly string[] {
    return this.entries;
  }
}

function dealView(id: string): Result<DealView, DealNotFound> {
  return id === 'missing'
    ? err(new DealNotFound({ dealId: id, message: 'Deal not found' }))
    : ok(new DealView(id, 'hidden'));
}

function dealSummary(id: string): Result<{ id: string }, DealNotFound> {
  return id === 'missing' ? err(new DealNotFound({ dealId: id, message: 'Deal not found' })) : ok({ id });
}

@Controller('above')
class InterceptorAboveMapErrorsController {
  constructor(@Inject(HandlerCallLog) private readonly callLog: HandlerCallLog) {}

  @Get('serialized/:id')
  @UseInterceptors(ClassSerializerInterceptor)
  @MapErrors({ DealNotFound: 404 })
  serialized(@Param('id') id: string): Result<DealView, DealNotFound> {
    this.callLog.record('serialized');
    return dealView(id);
  }

  @Get('wrapped/:id')
  @UseInterceptors(DataWrappingInterceptor)
  @MapErrors({ DealNotFound: 404 })
  wrapped(@Param('id') id: string): Result<{ id: string }, DealNotFound> {
    return dealSummary(id);
  }

  @Get('instance/:id')
  @UseInterceptors(new DataWrappingInterceptor())
  @MapErrors({ DealNotFound: 404 })
  instance(@Param('id') id: string): Result<{ id: string }, DealNotFound> {
    this.callLog.record('instance');
    return dealSummary(id);
  }
}

@Controller('below')
class InterceptorBelowMapErrorsController {
  @Get('serialized/:id')
  @MapErrors({ DealNotFound: 404 })
  @UseInterceptors(ClassSerializerInterceptor)
  serialized(@Param('id') id: string): Result<DealView, DealNotFound> {
    return dealView(id);
  }

  @Get('wrapped/:id')
  @MapErrors({ DealNotFound: 404 })
  @UseInterceptors(DataWrappingInterceptor)
  wrapped(@Param('id') id: string): Result<{ id: string }, DealNotFound> {
    return dealSummary(id);
  }
}

@Controller('controller-level')
@UseInterceptors(DataWrappingInterceptor)
class ControllerLevelInterceptorController {
  @Get(':id')
  @MapErrors({ DealNotFound: 404 })
  find(@Param('id') id: string): Result<{ id: string }, DealNotFound> {
    return dealSummary(id);
  }
}

describe.each(platforms)('a method-level interceptor declared above MapErrors on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, {
      imports: [ResultModule.forRoot()],
      controllers: [InterceptorAboveMapErrorsController],
      providers: [HandlerCallLog, ...recordingProviders],
    });
    return request(app.getHttpServer());
  };

  it('fails with 500 when a serializer above MapErrors would see an Err', async () => {
    const response = await (await start()).get('/above/serialized/missing');
    expect({ status: response.status, error: app.get(ExceptionRecorder).last }).toStrictEqual({
      status: 500,
      error: ResultInterceptorOrderError.forHandler('InterceptorAboveMapErrorsController.serialized'),
    });
  });

  it('fails with 500 when a serializer above MapErrors would see an Ok', async () => {
    const response = await (await start()).get('/above/serialized/7');
    expect({ status: response.status, error: app.get(ExceptionRecorder).last }).toStrictEqual({
      status: 500,
      error: ResultInterceptorOrderError.forHandler('InterceptorAboveMapErrorsController.serialized'),
    });
  });

  it('fails with 500 when a wrapping interceptor above MapErrors would see an Err', async () => {
    const response = await (await start()).get('/above/wrapped/missing');
    expect({ status: response.status, error: app.get(ExceptionRecorder).last }).toStrictEqual({
      status: 500,
      error: ResultInterceptorOrderError.forHandler('InterceptorAboveMapErrorsController.wrapped'),
    });
  });

  it('does not call the handler', async () => {
    await (await start()).get('/above/serialized/7');
    expect(app.get(HandlerCallLog).calls).toEqual([]);
  });

  it('fails with 500 when an interceptor instance above MapErrors would see an Err', async () => {
    const response = await (await start()).get('/above/instance/missing');
    expect({ status: response.status, error: app.get(ExceptionRecorder).last }).toStrictEqual({
      status: 500,
      error: ResultInterceptorOrderError.forHandler('InterceptorAboveMapErrorsController.instance'),
    });
  });

  it('does not call the handler under an interceptor instance', async () => {
    await (await start()).get('/above/instance/7');
    expect(app.get(HandlerCallLog).calls).toEqual([]);
  });
});

describe.each(platforms)('a method-level interceptor above MapErrors without ResultModule on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, {
      controllers: [InterceptorAboveMapErrorsController],
      providers: [HandlerCallLog, ...recordingProviders],
    });
    return request(app.getHttpServer());
  };

  it('fails with 500 from the route-level interceptor', async () => {
    const response = await (await start()).get('/above/serialized/missing');
    expect({ status: response.status, error: app.get(ExceptionRecorder).last }).toStrictEqual({
      status: 500,
      error: ResultInterceptorOrderError.forHandler('InterceptorAboveMapErrorsController.serialized'),
    });
  });

  it('does not call the handler', async () => {
    await (await start()).get('/above/serialized/7');
    expect(app.get(HandlerCallLog).calls).toEqual([]);
  });
});

describe.each(platforms)('a method-level interceptor declared below MapErrors on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, {
      imports: [ResultModule.forRoot()],
      controllers: [InterceptorBelowMapErrorsController],
    });
    return request(app.getHttpServer());
  };

  it('maps an Err to its status with the default body under a serializer', async () => {
    const response = await (await start()).get('/below/serialized/missing');
    expect({ status: response.status, body: response.body }).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'DealNotFound', message: 'Deal not found' },
    });
  });

  it('serializes the Ok value', async () => {
    const response = await (await start()).get('/below/serialized/7');
    expect({ status: response.status, body: response.body }).toEqual({ status: 200, body: { id: '7' } });
  });

  it('maps an Err to its status with the default body under a wrapping interceptor', async () => {
    const response = await (await start()).get('/below/wrapped/missing');
    expect({ status: response.status, body: response.body }).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'DealNotFound', message: 'Deal not found' },
    });
  });

  it('wraps the Ok value', async () => {
    const response = await (await start()).get('/below/wrapped/7');
    expect({ status: response.status, body: response.body }).toEqual({ status: 200, body: { data: { id: '7' } } });
  });
});

describe.each(platforms)('a controller-level interceptor with MapErrors on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, {
      imports: [ResultModule.forRoot()],
      controllers: [ControllerLevelInterceptorController],
    });
    return request(app.getHttpServer());
  };

  it('maps an Err to its status with the default body', async () => {
    const response = await (await start()).get('/controller-level/missing');
    expect({ status: response.status, body: response.body }).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'DealNotFound', message: 'Deal not found' },
    });
  });

  it('wraps the Ok value', async () => {
    const response = await (await start()).get('/controller-level/7');
    expect({ status: response.status, body: response.body }).toEqual({ status: 200, body: { data: { id: '7' } } });
  });
});

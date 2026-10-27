import {
  type ArgumentsHost,
  Catch,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  type ExceptionFilter,
  Get,
  HttpCode,
  HttpException,
  type INestApplication,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, HttpAdapterHost } from '@nestjs/core';
import { Exclude } from 'class-transformer';
import { err, errAsync, ok, okAsync, type Result, type ResultAsync } from 'neverthrow';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DuplicateNeverthrowError,
  errorDefaults,
  InvalidErrorStatusError,
  MapErrors,
  MissingErrorMapError,
  ProblemDetailsException,
  ResultModule,
  TaggedError,
} from '../../src/index.js';
import { createApp, platforms } from '../support/create-app.js';
import { AccessDenied, DealNotFound, ProjectArchived, ProjectNotFound, TaskNotFound } from '../support/errors.js';
import { ExceptionRecorder, recordingProviders } from '../support/exception-recorder.js';
import { problemDetailsMediaType } from '../support/nest-version.js';

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

  @Delete(':id')
  @HttpCode(204)
  @MapErrors({ AccessDenied: 403 })
  remove(): ResultAsync<void, AccessDenied> {
    return okAsync(undefined);
  }

  @Get('private/:id')
  @MapErrors({ DealNotFound: 404, AccessDenied: 403 })
  private findPrivately(@Param('id') id: string): ResultAsync<DealView, DealNotFound | AccessDenied> {
    return id === 'missing'
      ? errAsync(new DealNotFound({ dealId: id, message: 'Deal not found' }))
      : okAsync(new DealView(id, 'hidden'));
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

type ProjectError = ProjectNotFound | TaskNotFound | ProjectArchived;

function projectOutcome(id: string): ResultAsync<{ id: string }, ProjectError> {
  if (id === 'project') return errAsync(new ProjectNotFound());
  if (id === 'task') return errAsync(new TaskNotFound({ taskId: id }));
  if (id === 'archived') return errAsync(new ProjectArchived());
  return okAsync({ id });
}

const domainDefaults = errorDefaults({
  NotFound: 404,
  Conflict: 409,
  Archived: { status: 410, body: (error: { readonly _tag: string }) => ({ gone: error._tag }) },
});

const MapDomainErrors = MapErrors.withDefaults(domainDefaults);

@Controller('projects')
class ProjectsController {
  @Get('family/:id')
  @MapErrors({ NotFound: 404, ProjectArchived: 410 })
  byFamily(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return projectOutcome(id);
  }

  @Get('override/:id')
  @MapErrors({ TaskNotFound: 422, NotFound: 404, ProjectArchived: 410 })
  byOverride(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return projectOutcome(id);
  }

  @Get('defaults/:id')
  @MapDomainErrors({ ProjectArchived: 410 })
  byDefaults(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return projectOutcome(id);
  }

  @Get('default-override/:id')
  @MapDomainErrors({ TaskNotFound: 422, ProjectArchived: 410 })
  byDefaultOverride(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return projectOutcome(id);
  }
}

class ShelfGone extends TaggedError('ShelfGone', { family: 'Archived' }) {}

@Controller('shelves')
class ShelvesController {
  @Get()
  @MapDomainErrors({})
  find(): ResultAsync<number, ShelfGone> {
    return errAsync(new ShelfGone());
  }
}

class BookNotFound extends TaggedError('BookNotFound', { family: 'NotFound' })<{ message: string }> {}

const problemDefaults = errorDefaults(
  {
    NotFound: 404,
    Archived: { status: 410, body: (error: { readonly _tag: string }) => ({ gone: error._tag }) },
    ProjectArchived: { status: 409, type: 'https://example.com/problems/project-archived' },
  },
  { body: 'problem-details' },
);

const MapProblemErrors = MapErrors.withDefaults(problemDefaults);

@Controller('problems')
class ProblemsController {
  @Get('books/:id')
  @MapProblemErrors({ AccessDenied: 403 })
  findBook(@Param('id') id: string): ResultAsync<{ id: string }, BookNotFound | AccessDenied> {
    if (id === 'missing') return errAsync(new BookNotFound({ message: 'Book not found' }));
    if (id === 'forbidden') return errAsync(new AccessDenied());
    return okAsync({ id });
  }

  @Get('shelves')
  @MapProblemErrors({})
  findShelf(): ResultAsync<number, ShelfGone> {
    return errAsync(new ShelfGone());
  }

  @Get('deals/:id')
  @MapProblemErrors({
    DealNotFound: { status: 404, type: 'https://example.com/problems/deal-not-found', title: 'Deal not found' },
  })
  findDeal(@Param('id') id: string): ResultAsync<{ id: string }, DealNotFound | ProjectArchived> {
    if (id === 'missing') return errAsync(new DealNotFound({ dealId: id, message: 'No deal missing' }));
    if (id === 'archived') return errAsync(new ProjectArchived());
    return okAsync({ id });
  }
}

@Catch(HttpException)
class WrappingFilter implements ExceptionFilter {
  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const status = exception.getStatus();
    this.adapterHost.httpAdapter.reply(host.switchToHttp().getResponse(), { wrapped: status }, status);
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

  it('sends the default body as application/json', async () => {
    const response = await (await start()).get('/deals/async/missing');
    expect(response.headers['content-type']).toMatch(/^application\/json/);
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
    app = await createApp(platform, {
      imports: [ResultModule.forRoot()],
      controllers: [DealsController],
      providers: recordingProviders,
    });
    const response = await request(app.getHttpServer()).get('/deals/unmapped');
    expect({ status: response.status, error: app.get(ExceptionRecorder).last }).toStrictEqual({
      status: 500,
      error: MissingErrorMapError.forHandler('DealsController.unmapped'),
    });
  });

  it('lets a user HttpException filter rewrite the response of a mapped Err', async () => {
    app = await createApp(platform, {
      controllers: [DealsController],
      providers: [{ provide: APP_FILTER, useClass: WrappingFilter }],
    });
    const response = await request(app.getHttpServer()).get('/deals/async/missing');
    expect({ status: response.status, body: response.body }).toEqual({ status: 404, body: { wrapped: 404 } });
  });

  it('passes non-Result values through untouched', async () => {
    const response = await (await start()).get('/deals/plain');
    expect(response.body).toEqual({ plain: true });
  });

  it('responds 204 with an empty body for Ok(undefined) under HttpCode(204)', async () => {
    const response = await (await start()).delete('/deals/7');
    expect({ status: response.status, text: response.text }).toEqual({ status: 204, text: '' });
  });

  it('maps an Err from a private handler method', async () => {
    const response = await (await start()).get('/deals/private/missing');
    expect(response.status).toBe(404);
  });

  it('serializes the Ok value from a private handler method', async () => {
    const response = await (await start()).get('/deals/private/7');
    expect(response.body).toEqual({ id: '7' });
  });
});

describe('ResultModule safety net', () => {
  it('fails with 500 when a Result from another neverthrow copy reaches it', async () => {
    const app = await createApp('express', {
      imports: [ResultModule.forRoot()],
      controllers: [ForeignResultController],
      providers: recordingProviders,
    });
    const response = await request(app.getHttpServer()).get('/foreign');
    const recorded = app.get(ExceptionRecorder).last;
    await app.close();
    expect({ status: response.status, error: recorded }).toStrictEqual({
      status: 500,
      error: DuplicateNeverthrowError.forHandler('ForeignResultController.foreign'),
    });
  });
});

describe.each(platforms)('MapErrors with error families on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, { imports: [ResultModule.forRoot()], controllers: [ProjectsController] });
    return request(app.getHttpServer());
  };

  it('maps an error through its family key with the default body', async () => {
    const response = await (await start()).get('/projects/family/task');
    expect({ status: response.status, body: response.body }).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'TaskNotFound', message: 'TaskNotFound' },
    });
  });

  it('prefers a tag key over its family key', async () => {
    const response = await (await start()).get('/projects/override/task');
    expect(response.status).toBe(422);
  });

  it('maps another family member through the family key', async () => {
    const response = await (await start()).get('/projects/override/project');
    expect(response.status).toBe(404);
  });
});

describe('MapErrors status validation', () => {
  it('throws InvalidErrorStatusError at decoration time for a status outside 400–599', () => {
    expect(() => MapErrors({ DealNotFound: 302 })).toThrow(InvalidErrorStatusError);
  });
});

describe.each(platforms)('MapErrors with shared defaults on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, {
      imports: [ResultModule.forRoot()],
      controllers: [ProjectsController, ShelvesController],
    });
    return request(app.getHttpServer());
  };

  it('maps an error through a shared default', async () => {
    const response = await (await start()).get('/projects/defaults/project');
    expect({ status: response.status, body: response.body }).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'ProjectNotFound', message: 'ProjectNotFound' },
    });
  });

  it('keeps route keys for errors the defaults do not cover', async () => {
    const response = await (await start()).get('/projects/defaults/archived');
    expect(response.status).toBe(410);
  });

  it('prefers a route tag over a default family', async () => {
    const response = await (await start()).get('/projects/default-override/task');
    expect(response.status).toBe(422);
  });

  it('uses a default custom body as the whole body', async () => {
    const response = await (await start()).get('/shelves');
    expect({ status: response.status, body: response.body }).toEqual({ status: 410, body: { gone: 'ShelfGone' } });
  });

  it('sends a shared default body as application/json', async () => {
    const response = await (await start()).get('/projects/defaults/project');
    expect(response.headers['content-type']).toMatch(/^application\/json/);
  });
});

describe.each(platforms)('MapErrors with problem details defaults on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const start = async () => {
    app = await createApp(platform, { imports: [ResultModule.forRoot()], controllers: [ProblemsController] });
    return request(app.getHttpServer());
  };

  it('maps an error through a problem default with the problem details body', async () => {
    const response = await (await start()).get('/problems/books/missing');
    expect({ status: response.status, body: response.body }).toStrictEqual({
      status: 404,
      body: {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Book not found',
        code: 'BookNotFound',
        instance: '/problems/books/missing',
      },
    });
  });

  it('sends the problem details body as application/problem+json where Nest keeps that type', async () => {
    const response = await (await start()).get('/problems/books/missing');
    expect(response.headers['content-type']?.split(';')[0]).toBe(problemDetailsMediaType(platform));
  });

  it('leaves the query string out of the instance', async () => {
    const response = await (await start()).get('/problems/books/missing?token=x');
    expect(response.body.instance).toBe('/problems/books/missing');
  });

  it('gives a route number key the problem details body', async () => {
    const response = await (await start()).get('/problems/books/forbidden');
    expect({ status: response.status, body: response.body }).toStrictEqual({
      status: 403,
      body: {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'AccessDenied',
        code: 'AccessDenied',
        instance: '/problems/books/forbidden',
      },
    });
  });

  it('sends a custom body under problem defaults as-is', async () => {
    const response = await (await start()).get('/problems/shelves');
    expect({ status: response.status, body: response.body }).toStrictEqual({
      status: 410,
      body: { gone: 'ShelfGone' },
    });
  });

  it('sends a custom body under problem defaults as application/json', async () => {
    const response = await (await start()).get('/problems/shelves');
    expect(response.headers['content-type']).toMatch(/^application\/json/);
  });

  it('sends the type and title of a route problem type entry', async () => {
    const response = await (await start()).get('/problems/deals/missing');
    expect({ status: response.status, body: response.body }).toStrictEqual({
      status: 404,
      body: {
        type: 'https://example.com/problems/deal-not-found',
        title: 'Deal not found',
        status: 404,
        detail: 'No deal missing',
        code: 'DealNotFound',
        instance: '/problems/deals/missing',
      },
    });
  });

  it('sends a route problem type entry as application/problem+json where Nest keeps that type', async () => {
    const response = await (await start()).get('/problems/deals/missing');
    expect(response.headers['content-type']?.split(';')[0]).toBe(problemDetailsMediaType(platform));
  });

  it('titles a default problem type entry without a title with the reason phrase', async () => {
    const response = await (await start()).get('/problems/deals/archived');
    expect({ status: response.status, body: response.body }).toStrictEqual({
      status: 409,
      body: {
        type: 'https://example.com/problems/project-archived',
        title: 'Conflict',
        status: 409,
        detail: 'ProjectArchived',
        code: 'ProjectArchived',
        instance: '/problems/deals/archived',
      },
    });
  });
});

describe.each(platforms)('MapErrors exceptions under problem details defaults on %s', (platform) => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  const rejectionAt = async (path: string) => {
    app = await createApp(platform, {
      imports: [ResultModule.forRoot()],
      controllers: [ProblemsController, ProjectsController],
      providers: recordingProviders,
    });
    await request(app.getHttpServer()).get(path);
    return app.get(ExceptionRecorder).last;
  };

  it('throws a ProblemDetailsException for a problem default', async () => {
    const rejection = await rejectionAt('/problems/books/missing');
    expect(rejection).toBeInstanceOf(ProblemDetailsException);
  });

  it('throws a problem default as an HttpException', async () => {
    const rejection = await rejectionAt('/problems/books/missing');
    expect(rejection).toBeInstanceOf(HttpException);
  });

  it('carries the status, problem details body and cause of a problem default', async () => {
    const rejection = (await rejectionAt('/problems/books/missing')) as HttpException;
    expect({ status: rejection.getStatus(), body: rejection.getResponse(), cause: rejection.cause }).toStrictEqual({
      status: 404,
      body: {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Book not found',
        code: 'BookNotFound',
        instance: '/problems/books/missing',
      },
      cause: expect.any(BookNotFound),
    });
  });

  it('throws a custom body under problem defaults as an HttpException', async () => {
    const rejection = await rejectionAt('/problems/shelves');
    expect(rejection).toBeInstanceOf(HttpException);
  });

  it('throws a custom body under problem defaults as no ProblemDetailsException', async () => {
    const rejection = await rejectionAt('/problems/shelves');
    expect(rejection).not.toBeInstanceOf(ProblemDetailsException);
  });

  it('throws a plain default as an HttpException', async () => {
    const rejection = await rejectionAt('/projects/defaults/project');
    expect(rejection).toBeInstanceOf(HttpException);
  });

  it('throws a plain default as no ProblemDetailsException', async () => {
    const rejection = await rejectionAt('/projects/defaults/project');
    expect(rejection).not.toBeInstanceOf(ProblemDetailsException);
  });
});

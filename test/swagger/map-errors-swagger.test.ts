import { Controller, Get, HttpCode, type INestApplication, Param, Post } from '@nestjs/common';
import {
  ApiDefaultResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
  ApiProperty,
  DocumentBuilder,
  type OpenAPIObject,
  type SchemaObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { errAsync, ok, okAsync, type Result, type ResultAsync } from 'neverthrow';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorDefaults } from '../../src/index.js';
import { MapErrors } from '../../src/swagger/index.js';
import { TransactionalResult } from '../../src/transactional/index.js';
import { createApp } from '../support/create-app.js';
import { problemDetailsMediaType } from '../support/nest-version.js';
import { AccessDenied, DealNotFound, ProjectArchived, ProjectNotFound, TaskNotFound, Unavailable } from '../support/errors.js';

@Controller('deals')
class DealsController {
  @Get(':id')
  @MapErrors({
    DealNotFound: 404,
    AccessDenied: 404,
    Unavailable: { status: 503, body: (e: Unavailable) => ({ retry: e._tag }) },
  })
  find(@Param('id') id: string): ResultAsync<{ id: string }, DealNotFound | AccessDenied | Unavailable> {
    return id === 'x' ? errAsync(new AccessDenied()) : okAsync({ id });
  }
}

const DocumentedDomainErrors = MapErrors.withDefaults(errorDefaults({ NotFound: 404, Conflict: 409, Throttled: 429 }));

type ProjectError = ProjectNotFound | TaskNotFound | ProjectArchived;

@Controller('projects')
class ProjectsController {
  @Get(':id')
  @DocumentedDomainErrors({ ProjectArchived: 410 }, { uses: ['NotFound'], families: ['NotFound'] })
  find(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return id === 'x' ? errAsync(new TaskNotFound({ taskId: id })) : okAsync({ id });
  }

  @Get('override/:id')
  @DocumentedDomainErrors({ NotFound: 422, ProjectArchived: 410 }, { uses: [], families: ['NotFound'] })
  findOverridden(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return okAsync({ id });
  }
}

class RetryBody {
  @ApiProperty({ type: String })
  readonly retry!: string;
}

const retrySchema: SchemaObject = { type: 'object', properties: { retry: { type: 'string' } } };

const retryBody = (e: Unavailable | AccessDenied) => ({ retry: e._tag });

@Controller('payments')
class PaymentsController {
  @Get('dto')
  @MapErrors({ Unavailable: { status: 503, body: retryBody } }, { schemas: { Unavailable: RetryBody } })
  withDto(): ResultAsync<{ id: string }, Unavailable> {
    return okAsync({ id: 'p' });
  }

  @Get('schema')
  @MapErrors({ Unavailable: { status: 503, body: retryBody } }, { schemas: { Unavailable: retrySchema } })
  withSchema(): ResultAsync<{ id: string }, Unavailable> {
    return okAsync({ id: 'p' });
  }

  @Get('mixed')
  @MapErrors(
    { AccessDenied: 503, Unavailable: { status: 503, body: retryBody } },
    { schemas: { Unavailable: RetryBody } },
  )
  mixed(): ResultAsync<{ id: string }, AccessDenied | Unavailable> {
    return okAsync({ id: 'p' });
  }

  @Get('shared')
  @MapErrors(
    { AccessDenied: { status: 503, body: retryBody }, Unavailable: { status: 503, body: retryBody } },
    { schemas: { AccessDenied: RetryBody, Unavailable: RetryBody } },
  )
  shared(): ResultAsync<{ id: string }, AccessDenied | Unavailable> {
    return okAsync({ id: 'p' });
  }

  @Get('replaced')
  @MapErrors({ AccessDenied: 403 }, { schemas: { AccessDenied: retrySchema } })
  replaced(): ResultAsync<{ id: string }, AccessDenied> {
    return okAsync({ id: 'p' });
  }
}

class DealSummary {
  @ApiProperty({ type: String })
  readonly id!: string;
}

@Controller('summaries')
class SummariesController {
  @Get(':id')
  @ApiNotFoundResponse({ type: DealSummary })
  @MapErrors({ DealNotFound: 404 })
  find(@Param('id') id: string): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id });
  }
}

@Controller('outcomes')
class OutcomesController {
  @Get('read')
  @MapErrors({ DealNotFound: 404 })
  read(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @MapErrors({ DealNotFound: 404 })
  @Get('read-below')
  readBelow(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @Post('create')
  @MapErrors({ DealNotFound: 404 })
  create(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @MapErrors({ DealNotFound: 404 })
  @Post('create-below')
  createBelow(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @Post('accept')
  @HttpCode(202)
  @MapErrors({ DealNotFound: 404 })
  accept(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @MapErrors({ DealNotFound: 404 })
  @Post('accept-below')
  @HttpCode(202)
  acceptBelow(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @Get('summary')
  @ApiOkResponse({ type: DealSummary })
  @MapErrors({ DealNotFound: 404 })
  summary(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @Get('summary-below')
  @MapErrors({ DealNotFound: 404 })
  @ApiOkResponse({ type: DealSummary })
  summaryBelow(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @Get('empty')
  @ApiNoContentResponse()
  @MapErrors({ DealNotFound: 404 })
  empty(): ResultAsync<undefined, DealNotFound> {
    return okAsync(undefined);
  }

  @Get('redirect')
  @ApiResponse({ status: 302 })
  @MapErrors({ DealNotFound: 404 })
  redirect(): ResultAsync<undefined, DealNotFound> {
    return okAsync(undefined);
  }

  @Get('fallback')
  @ApiDefaultResponse()
  @MapErrors({ DealNotFound: 404 })
  fallback(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }

  @Get('transactional')
  @TransactionalResult()
  @MapErrors({ DealNotFound: 404 })
  async transactional(): Promise<Result<{ id: string }, DealNotFound>> {
    return ok({ id: 'o' });
  }
}

@ApiOkResponse({ type: DealSummary })
@Controller('declared-outcomes')
class DeclaredOutcomesController {
  @Get('read')
  @MapErrors({ DealNotFound: 404 })
  read(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }
}

@ApiOkResponse({ type: DealSummary })
class DeclaredOutcomesBase {}

@Controller('inherited-outcomes')
class InheritedOutcomesController extends DeclaredOutcomesBase {
  @Get('read')
  @MapErrors({ DealNotFound: 404 })
  read(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }
}

class InheritedOutcomeRoutes {
  @Get('read')
  @MapErrors({ DealNotFound: 404 })
  read(): ResultAsync<{ id: string }, DealNotFound> {
    return okAsync({ id: 'o' });
  }
}

@ApiOkResponse({ type: DealSummary })
@Controller('subclassed-outcomes')
class SubclassedOutcomesController extends InheritedOutcomeRoutes {}

@ApiNoContentResponse()
@Controller('subclassed-empty-outcomes')
class SubclassedEmptyOutcomesController extends InheritedOutcomeRoutes {}

@ApiNoContentResponse()
@Controller('empty-outcomes')
class EmptyOutcomesController {
  @Get('read')
  @MapErrors({ DealNotFound: 404 })
  read(): ResultAsync<undefined, DealNotFound> {
    return okAsync(undefined);
  }
}

const DocumentedProblemErrors = MapErrors.withDefaults(
  errorDefaults({ NotFound: 404, Conflict: 409 }, { body: 'problem-details' }),
);

const DocumentedTypedProblemErrors = MapErrors.withDefaults(
  errorDefaults({ NotFound: { status: 404, type: 'https://example.com/problems/not-found' } }, { body: 'problem-details' }),
);

@Controller('problems')
class ProblemsController {
  @Get('deals/:id')
  @DocumentedProblemErrors({ DealNotFound: 404, AccessDenied: 404 }, { uses: [] })
  findDeal(@Param('id') id: string): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return id === 'x' ? errAsync(new AccessDenied()) : okAsync({ id });
  }

  @Get('projects/:id')
  @DocumentedProblemErrors({ ProjectArchived: 410 }, { uses: ['NotFound'], families: ['NotFound'] })
  findProject(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return okAsync({ id });
  }

  @Get('mixed')
  @DocumentedProblemErrors(
    { AccessDenied: 503, Unavailable: { status: 503, body: retryBody } },
    { uses: [], schemas: { Unavailable: RetryBody } },
  )
  mixed(): ResultAsync<{ id: string }, AccessDenied | Unavailable> {
    return okAsync({ id: 'p' });
  }

  @Get('replaced')
  @DocumentedProblemErrors({ AccessDenied: 403 }, { uses: [], schemas: { AccessDenied: retrySchema } })
  replaced(): ResultAsync<{ id: string }, AccessDenied> {
    return okAsync({ id: 'p' });
  }

  @Get('combined')
  @DocumentedProblemErrors(
    { DealNotFound: 404, AccessDenied: 404 },
    { uses: [], schemas: { AccessDenied: retrySchema } },
  )
  combined(): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return okAsync({ id: 'p' });
  }

  @Get('custom')
  @DocumentedProblemErrors(
    { Unavailable: { status: 503, body: retryBody } },
    { uses: [], schemas: { Unavailable: RetryBody } },
  )
  custom(): ResultAsync<{ id: string }, Unavailable> {
    return okAsync({ id: 'p' });
  }

  @Get('typed/:id')
  @DocumentedProblemErrors(
    {
      DealNotFound: { status: 404, type: 'https://example.com/problems/deal-not-found', title: 'Deal not found' },
      AccessDenied: 404,
    },
    { uses: [] },
  )
  findTyped(@Param('id') id: string): ResultAsync<{ id: string }, DealNotFound | AccessDenied> {
    return id === 'x' ? errAsync(new DealNotFound({ dealId: id, message: 'No deal x' })) : okAsync({ id });
  }

  @Get('typed-projects/:id')
  @DocumentedTypedProblemErrors({ ProjectArchived: 410 }, { uses: ['NotFound'], families: ['NotFound'] })
  findTypedProject(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return okAsync({ id });
  }
}

const controllers = [
  DealsController,
  ProjectsController,
  PaymentsController,
  SummariesController,
  ProblemsController,
  OutcomesController,
  DeclaredOutcomesController,
  InheritedOutcomesController,
  EmptyOutcomesController,
  SubclassedOutcomesController,
  SubclassedEmptyOutcomesController,
];

const documentOf = (app: INestApplication): OpenAPIObject =>
  SwaggerModule.createDocument(app, new DocumentBuilder().build());

describe('swagger MapErrors', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createApp('express', { controllers });
    document = documentOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents one response per distinct status, listing the tags that share it', () => {
    const responses = document.paths['/deals/{id}']?.get?.responses;
    expect(responses).toMatchObject({
      '404': { description: 'DealNotFound, AccessDenied' },
      '503': { description: 'Unavailable' },
    });
  });

  it('maps an Err to its status with the default body', async () => {
    const response = await request(app.getHttpServer()).get('/deals/x');
    expect({ status: response.status, body: response.body }).toEqual({
      status: 404,
      body: { statusCode: 404, code: 'AccessDenied', message: 'AccessDenied' },
    });
  });

  it('documents a used default under its own status', () => {
    expect(document.paths['/projects/{id}']?.get?.responses).toMatchObject({
      '404': { description: 'NotFound (family)' },
    });
  });

  it('documents only the statuses the route can produce', () => {
    expect(Object.keys(document.paths['/projects/{id}']?.get?.responses ?? {}).sort()).toEqual(['200', '404', '410']);
  });

  it('documents a route override instead of the default it replaces', () => {
    expect(Object.keys(document.paths['/projects/override/{id}']?.get?.responses ?? {}).sort()).toEqual([
      '200',
      '410',
      '422',
    ]);
  });

  it.each([
    ['/outcomes/read', 'get', '200'],
    ['/outcomes/read-below', 'get', '200'],
    ['/outcomes/create', 'post', '201'],
    ['/outcomes/create-below', 'post', '201'],
    ['/outcomes/accept', 'post', '202'],
    ['/outcomes/accept-below', 'post', '202'],
    ['/outcomes/transactional', 'get', '200'],
  ] as const)('documents the implicit success status of %s', (path, method, status) => {
    expect(Object.keys(document.paths[path]?.[method]?.responses ?? {}).sort()).toEqual([status, '404']);
  });

  it.each(['/outcomes/summary', '/outcomes/summary-below'])('keeps a success response declared on %s', (path) => {
    expect(document.paths[path]?.get?.responses['200']).toHaveProperty(['content', 'application/json', 'schema'], {
      $ref: '#/components/schemas/DealSummary',
    });
  });

  it.each([
    ['/outcomes/empty', '204'],
    ['/outcomes/redirect', '302'],
  ])('adds no implicit success status to %s, which declares another non-error status', (path, status) => {
    expect(Object.keys(document.paths[path]?.get?.responses ?? {}).sort()).toEqual([status, '404']);
  });

  it('keeps a success response declared on the controller', () => {
    expect(document.paths['/declared-outcomes/read']?.get?.responses['200']).toHaveProperty(
      ['content', 'application/json', 'schema'],
      { $ref: '#/components/schemas/DealSummary' },
    );
  });

  it('keeps a success response declared on a base class of the controller', () => {
    expect(document.paths['/inherited-outcomes/read']?.get?.responses['200']).toHaveProperty(
      ['content', 'application/json', 'schema'],
      { $ref: '#/components/schemas/DealSummary' },
    );
  });

  it('documents the implicit success status beside a default response', () => {
    expect(Object.keys(document.paths['/outcomes/fallback']?.get?.responses ?? {}).sort()).toEqual([
      '200',
      '404',
      'default',
    ]);
  });

  it('replaces a success response declared on a subclass controller of an inherited route', () => {
    expect(document.paths['/subclassed-outcomes/read']?.get?.responses['200']).toEqual({ description: '' });
  });

  it('documents the implicit success status beside another status declared on a subclass controller of an inherited route', () => {
    expect(Object.keys(document.paths['/subclassed-empty-outcomes/read']?.get?.responses ?? {}).sort()).toEqual([
      '200',
      '204',
      '404',
    ]);
  });

  it('adds no implicit success status under a controller declaring another non-error status', () => {
    expect(Object.keys(document.paths['/empty-outcomes/read']?.get?.responses ?? {}).sort()).toEqual(['204', '404']);
  });

  it('documents the default body of a tag-only status with its tags as the code enum', () => {
    const content = document.paths['/deals/{id}']?.get?.responses['404'];
    expect(content).toMatchObject({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['statusCode', 'code', 'message'],
            properties: {
              statusCode: { type: 'integer', enum: [404] },
              code: { type: 'string', enum: ['DealNotFound', 'AccessDenied'] },
              message: { type: 'string' },
            },
          },
        },
      },
    });
  });

  it('documents an example per tag of a default-body status', () => {
    const response = document.paths['/deals/{id}']?.get?.responses['404'];
    expect(response).toMatchObject({
      content: {
        'application/json': {
          examples: {
            DealNotFound: {
              summary: 'DealNotFound',
              value: { statusCode: 404, code: 'DealNotFound', message: 'DealNotFound' },
            },
            AccessDenied: {
              summary: 'AccessDenied',
              value: { statusCode: 404, code: 'AccessDenied', message: 'AccessDenied' },
            },
          },
        },
      },
    });
  });

  it('documents the code of a status with a listed family as a plain string', () => {
    expect(document.paths['/projects/{id}']?.get?.responses['404']).toHaveProperty(
      ['content', 'application/json', 'schema', 'properties', 'code'],
      { type: 'string' },
    );
  });

  it('marks a listed family key of the route map in the description', () => {
    expect(document.paths['/projects/override/{id}']?.get?.responses).toMatchObject({
      '422': { description: 'NotFound (family)' },
    });
  });

  it('documents no example for a family key', () => {
    expect(document.paths['/projects/{id}']?.get?.responses['404']).not.toHaveProperty([
      'content',
      'application/json',
      'examples',
    ]);
  });

  it('documents a custom body with a class schema as a reference', () => {
    expect(document.paths['/payments/dto']?.get?.responses['503']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/RetryBody' } } },
    });
  });

  it('registers the class schema of a custom body as a component', () => {
    expect(document.components?.schemas?.['RetryBody']).toEqual({
      type: 'object',
      properties: { retry: { type: 'string' } },
      required: ['retry'],
    });
  });

  it('documents a custom body with a schema object as given', () => {
    expect(document.paths['/payments/schema']?.get?.responses['503']).toMatchObject({
      content: { 'application/json': { schema: retrySchema } },
    });
  });

  it('documents no body for a custom body without a schema', () => {
    expect(document.paths['/deals/{id}']?.get?.responses['503']).not.toHaveProperty('content');
  });

  it('documents the distinct bodies of one status as alternatives', () => {
    expect(document.paths['/payments/mixed']?.get?.responses['503']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            oneOf: [
              {
                type: 'object',
                required: ['statusCode', 'code', 'message'],
                properties: {
                  statusCode: { type: 'integer', enum: [503] },
                  code: { type: 'string', enum: ['AccessDenied'] },
                  message: { type: 'string' },
                },
              },
              { $ref: '#/components/schemas/RetryBody' },
            ],
          },
        },
      },
    });
  });

  it('documents a body shared by several keys once', () => {
    expect(document.paths['/payments/shared']?.get?.responses['503']).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/RetryBody' } } },
    });
  });

  it('documents a schema given for a default-body key instead of the default body', () => {
    expect(document.paths['/payments/replaced']?.get?.responses['403']).toEqual({
      description: 'AccessDenied',
      content: { 'application/json': { schema: retrySchema } },
    });
  });

  it('produces the same document on Express and Fastify', async () => {
    const expressApp = await createApp('express', { controllers });
    const fastifyApp = await createApp('fastify', { controllers });
    const expressDocument = documentOf(expressApp);
    const fastifyDocument = documentOf(fastifyApp);
    await Promise.all([expressApp.close(), fastifyApp.close()]);
    expect({ paths: fastifyDocument.paths, components: fastifyDocument.components }).toEqual({
      paths: expressDocument.paths,
      components: expressDocument.components,
    });
  });

  it('keeps the type of a response decorator applied after it', () => {
    expect(document.paths['/summaries/{id}']?.get?.responses['404']).toHaveProperty(
      ['content', 'application/json', 'schema'],
      { $ref: '#/components/schemas/DealSummary' },
    );
  });

  it('maps an Err through the defaults at runtime', async () => {
    const response = await request(app.getHttpServer()).get('/projects/x');
    expect({ status: response.status, code: response.body.code }).toEqual({ status: 404, code: 'TaskNotFound' });
  });

  it('documents the problem details body of a default-body status under application/problem+json', () => {
    expect(document.paths['/problems/deals/{id}']?.get?.responses['404']).toHaveProperty(
      ['content', 'application/problem+json', 'schema'],
      {
        type: 'object',
        required: ['type', 'title', 'status', 'detail', 'code'],
        properties: {
          type: { type: 'string', enum: ['about:blank'] },
          title: { type: 'string', enum: ['Not Found'] },
          status: { type: 'integer', enum: [404] },
          detail: { type: 'string' },
          code: { type: 'string', enum: ['DealNotFound', 'AccessDenied'] },
          instance: { type: 'string', format: 'uri-reference' },
        },
      },
    );
  });

  it('documents a problem details status without an application/json body', () => {
    expect(document.paths['/problems/deals/{id}']?.get?.responses['404']).not.toHaveProperty([
      'content',
      'application/json',
    ]);
  });

  it('documents the reason phrase of the status as the problem title', () => {
    expect(document.paths['/problems/projects/{id}']?.get?.responses['410']).toHaveProperty(
      ['content', 'application/problem+json', 'schema', 'properties', 'title'],
      { type: 'string', enum: ['Gone'] },
    );
  });

  it('documents a problem details example per tag', () => {
    expect(document.paths['/problems/deals/{id}']?.get?.responses['404']).toHaveProperty(
      ['content', 'application/problem+json', 'examples'],
      {
        DealNotFound: {
          summary: 'DealNotFound',
          value: { type: 'about:blank', title: 'Not Found', status: 404, detail: 'DealNotFound', code: 'DealNotFound' },
        },
        AccessDenied: {
          summary: 'AccessDenied',
          value: { type: 'about:blank', title: 'Not Found', status: 404, detail: 'AccessDenied', code: 'AccessDenied' },
        },
      },
    );
  });

  it('documents the problem code of a status with a listed family as a plain string', () => {
    expect(document.paths['/problems/projects/{id}']?.get?.responses['404']).toHaveProperty(
      ['content', 'application/problem+json', 'schema', 'properties', 'code'],
      { type: 'string' },
    );
  });

  it('documents a status mixing problem details and a custom body under both media types', () => {
    expect(document.paths['/problems/mixed']?.get?.responses['503']).toMatchObject({
      content: {
        'application/problem+json': {
          schema: { properties: { status: { enum: [503] }, code: { enum: ['AccessDenied'] } } },
        },
        'application/json': { schema: { $ref: '#/components/schemas/RetryBody' } },
      },
    });
  });

  it('documents a schema given for a status-only problem details key under application/problem+json', () => {
    expect(document.paths['/problems/replaced']?.get?.responses['403']).toEqual({
      description: 'AccessDenied',
      content: { 'application/problem+json': { schema: retrySchema } },
    });
  });

  it('documents a schema given for a status-only key beside the problem details schema as an alternative', () => {
    expect(document.paths['/problems/combined']?.get?.responses['404']).toMatchObject({
      content: {
        'application/problem+json': {
          schema: { oneOf: [{ properties: { code: { enum: ['DealNotFound'] } } }, retrySchema] },
        },
      },
    });
  });

  it('documents a schema given for a custom-body key of problem details defaults under application/json', () => {
    expect(document.paths['/problems/custom']?.get?.responses['503']).toEqual({
      description: 'Unavailable',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/RetryBody' } } },
    });
  });

  it('documents the problem types at a status as the type enum', () => {
    expect(document.paths['/problems/typed/{id}']?.get?.responses['404']).toHaveProperty(
      ['content', 'application/problem+json', 'schema', 'properties', 'type'],
      { type: 'string', enum: ['https://example.com/problems/deal-not-found', 'about:blank'] },
    );
  });

  it('documents the problem titles at a status as the title enum', () => {
    expect(document.paths['/problems/typed/{id}']?.get?.responses['404']).toHaveProperty(
      ['content', 'application/problem+json', 'schema', 'properties', 'title'],
      { type: 'string', enum: ['Deal not found', 'Not Found'] },
    );
  });

  it('documents the type and title of each tag in its problem details example', () => {
    expect(document.paths['/problems/typed/{id}']?.get?.responses['404']).toHaveProperty(
      ['content', 'application/problem+json', 'examples'],
      {
        DealNotFound: {
          summary: 'DealNotFound',
          value: {
            type: 'https://example.com/problems/deal-not-found',
            title: 'Deal not found',
            status: 404,
            detail: 'DealNotFound',
            code: 'DealNotFound',
          },
        },
        AccessDenied: {
          summary: 'AccessDenied',
          value: { type: 'about:blank', title: 'Not Found', status: 404, detail: 'AccessDenied', code: 'AccessDenied' },
        },
      },
    );
  });

  it('documents the problem type of a family default and the reason phrase as its title', () => {
    expect(document.paths['/problems/typed-projects/{id}']?.get?.responses['404']).toMatchObject({
      content: {
        'application/problem+json': {
          schema: {
            properties: {
              type: { enum: ['https://example.com/problems/not-found'] },
              title: { enum: ['Not Found'] },
            },
          },
        },
      },
    });
  });

  it('sends the type and title of a documented problem type entry', async () => {
    const response = await request(app.getHttpServer()).get('/problems/typed/x');
    expect(response.body).toMatchObject({
      type: 'https://example.com/problems/deal-not-found',
      title: 'Deal not found',
      detail: 'No deal x',
    });
  });

  it('documents plain defaults without an application/problem+json body', () => {
    expect(document.paths['/projects/{id}']?.get?.responses['404']).not.toHaveProperty([
      'content',
      'application/problem+json',
    ]);
  });

  it('sends a problem details Err as application/problem+json where Nest keeps that type', async () => {
    const response = await request(app.getHttpServer()).get('/problems/deals/x');
    expect(response.headers['content-type']?.split(';')[0]).toBe(problemDetailsMediaType('express'));
  });
});

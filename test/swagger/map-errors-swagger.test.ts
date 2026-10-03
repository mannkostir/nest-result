import { Controller, Get, type INestApplication, Param } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { errAsync, okAsync, type ResultAsync } from 'neverthrow';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorDefaults } from '../../src/index.js';
import { MapErrors } from '../../src/swagger/index.js';
import { createApp } from '../support/create-app.js';
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
  @DocumentedDomainErrors({ ProjectArchived: 410 }, { uses: ['NotFound'] })
  find(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return id === 'x' ? errAsync(new TaskNotFound({ taskId: id })) : okAsync({ id });
  }

  @Get('override/:id')
  @DocumentedDomainErrors({ NotFound: 422, ProjectArchived: 410 }, { uses: [] })
  findOverridden(@Param('id') id: string): ResultAsync<{ id: string }, ProjectError> {
    return okAsync({ id });
  }
}

describe('swagger MapErrors', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createApp('express', { controllers: [DealsController, ProjectsController] });
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
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
    expect(document.paths['/projects/{id}']?.get?.responses).toMatchObject({ '404': { description: 'NotFound' } });
  });

  it('documents only the statuses the route can produce', () => {
    expect(Object.keys(document.paths['/projects/{id}']?.get?.responses ?? {}).sort()).toEqual(['404', '410']);
  });

  it('documents a route override instead of the default it replaces', () => {
    expect(Object.keys(document.paths['/projects/override/{id}']?.get?.responses ?? {}).sort()).toEqual(['410', '422']);
  });

  it('maps an Err through the defaults at runtime', async () => {
    const response = await request(app.getHttpServer()).get('/projects/x');
    expect({ status: response.status, code: response.body.code }).toEqual({ status: 404, code: 'TaskNotFound' });
  });
});

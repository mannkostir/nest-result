import { Controller, Get, type INestApplication, Param } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { errAsync, okAsync, type ResultAsync } from 'neverthrow';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MapErrors } from '../../src/swagger/index.js';
import { createApp } from '../support/create-app.js';
import { AccessDenied, DealNotFound, Unavailable } from '../support/errors.js';

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

describe('swagger MapErrors', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createApp('express', { controllers: [DealsController] });
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
});

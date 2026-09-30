import 'reflect-metadata';
import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

export type Platform = 'express' | 'fastify';

export const platforms: readonly Platform[] = ['express', 'fastify'];

export async function createApp(platform: Platform, metadata: ModuleMetadata): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule(metadata).compile();
  if (platform === 'express') return initialised(moduleRef.createNestApplication());
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await initialised(app);
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function initialised<A extends INestApplication>(app: A): Promise<A> {
  await app.init();
  return app;
}

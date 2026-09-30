import { type DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResultInterceptor } from './result.interceptor.js';

@Module({})
export class ResultModule {
  static forRoot(): DynamicModule {
    return {
      module: ResultModule,
      global: true,
      providers: [{ provide: APP_INTERCEPTOR, useClass: ResultInterceptor }],
    };
  }
}

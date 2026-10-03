import { type CallHandler, type ExecutionContext, Inject, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, mergeMap, type Observable } from 'rxjs';
import type { ErrorMapping } from '../core/error-mapping.js';
import { DuplicateNeverthrowError, MissingErrorMapError } from '../core/library-errors.js';
import { isResult, isResultAsync, looksLikeForeignResult } from '../core/result-detection.js';
import { ERROR_MAP_METADATA } from './error-map-metadata.js';
import { exceptionFor } from './exception-for.js';

@Injectable()
export class ResultInterceptor implements NestInterceptor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const mapping = this.reflector.get<ErrorMapping | undefined>(ERROR_MAP_METADATA, context.getHandler());
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    return next.handle().pipe(mergeMap((value: unknown) => from(unwrapResponse(value, mapping, handler))));
  }
}

async function unwrapResponse(value: unknown, mapping: ErrorMapping | undefined, handler: string): Promise<unknown> {
  const settled = isResultAsync(value) ? await value : value;
  if (!isResult(settled)) return passThrough(settled, handler);
  if (mapping === undefined) throw MissingErrorMapError.forHandler(handler);
  if (settled.isErr()) throw exceptionFor(settled.error, mapping);
  return settled.value;
}

function passThrough(value: unknown, handler: string): unknown {
  if (looksLikeForeignResult(value)) throw DuplicateNeverthrowError.forHandler(handler);
  return value;
}

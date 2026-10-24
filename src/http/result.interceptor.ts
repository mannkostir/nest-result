import {
  type CallHandler,
  type ExecutionContext,
  type HttpException,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants.js';
import { type AbstractHttpAdapter, HttpAdapterHost, Reflector } from '@nestjs/core';
import { from, mergeMap, type Observable } from 'rxjs';
import type { ErrorMapping } from '../core/error-mapping.js';
import {
  DuplicateNeverthrowError,
  MissingErrorMapError,
  ResultInterceptorOrderError,
  type UnmappedErrorTagError,
  type UntaggedErrorValueError,
} from '../core/library-errors.js';
import { isResult, isResultAsync, looksLikeForeignResult } from '../core/result-detection.js';
import { ERROR_MAP_METADATA } from './error-map-metadata.js';
import { exceptionFor } from './exception-for.js';

type HttpExchange = { readonly adapter: AbstractHttpAdapter; readonly request: unknown; readonly response: unknown };

@Injectable()
export class ResultInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(HttpAdapterHost) private readonly adapterHost?: HttpAdapterHost,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const mapping = this.reflector.get<ErrorMapping | undefined>(ERROR_MAP_METADATA, context.getHandler());
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    if (mapping !== undefined && !this.runsInnermost(context)) throw ResultInterceptorOrderError.forHandler(handler);
    const exchange = this.exchangeOf(context);
    return next.handle().pipe(mergeMap((value: unknown) => from(unwrapResponse(value, mapping, handler, exchange))));
  }

  private runsInnermost(context: ExecutionContext): boolean {
    const methodInterceptors = this.reflector.get<readonly unknown[] | undefined>(
      INTERCEPTORS_METADATA,
      context.getHandler(),
    );
    return methodInterceptors?.at(-1) === ResultInterceptor;
  }

  private exchangeOf(context: ExecutionContext): HttpExchange | undefined {
    const adapter = this.adapterHost?.httpAdapter;
    if (context.getType() !== 'http' || adapter === undefined) return undefined;
    const http = context.switchToHttp();
    return { adapter, request: http.getRequest(), response: http.getResponse() };
  }
}

async function unwrapResponse(
  value: unknown,
  mapping: ErrorMapping | undefined,
  handler: string,
  exchange: HttpExchange | undefined,
): Promise<unknown> {
  const settled = isResultAsync(value) ? await value : value;
  if (!isResult(settled)) return passThrough(settled, handler);
  if (mapping === undefined) throw MissingErrorMapError.forHandler(handler);
  if (settled.isErr()) throw rejectionFor(settled.error, mapping, exchange);
  return settled.value;
}

function rejectionFor(
  error: unknown,
  mapping: ErrorMapping,
  exchange: HttpExchange | undefined,
): HttpException | UnmappedErrorTagError | UntaggedErrorValueError {
  const mapped = exceptionFor(error, mapping, exchange === undefined ? undefined : requestPathOf(exchange));
  if (mapped.isErr()) return mapped.error;
  if (mapped.value.problemDetails && exchange !== undefined) {
    exchange.adapter.setHeader(exchange.response, 'Content-Type', 'application/problem+json');
  }
  return mapped.value.exception;
}

function requestPathOf({ adapter, request }: HttpExchange): string {
  const url: string = adapter.getRequestUrl(request);
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

function passThrough(value: unknown, handler: string): unknown {
  if (looksLikeForeignResult(value)) throw DuplicateNeverthrowError.forHandler(handler);
  return value;
}

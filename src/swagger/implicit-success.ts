import { HttpStatus, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { ApiResponse, DECORATORS } from '@nestjs/swagger';

const reflector = new Reflector();

const nonErrorStatus = /^[1-3]/;

export function documentImplicitSuccessOnceDecorated(target: object, key: string | symbol): void {
  queueMicrotask(() => documentImplicitSuccess(target, key));
}

function documentImplicitSuccess(target: object, key: string | symbol): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const method: unknown = descriptor?.value;
  if (descriptor === undefined || typeof method !== 'function') return;
  if ([method, target.constructor].some(documentsNonErrorStatus)) return;
  ApiResponse({ status: implicitSuccessStatusOf(method) })(target, key, descriptor);
}

function documentsNonErrorStatus(documented: Function): boolean {
  const responses = reflector.get<Readonly<Record<string, unknown>> | undefined>(DECORATORS.API_RESPONSE, documented);
  return Object.keys(responses ?? {}).some((status) => nonErrorStatus.test(status));
}

function implicitSuccessStatusOf(method: Function): number {
  const declared = reflector.get<number | undefined>(HTTP_CODE_METADATA, method);
  if (declared !== undefined) return declared;
  const requestMethod = reflector.get<RequestMethod | undefined>(METHOD_METADATA, method);
  return requestMethod === RequestMethod.POST ? HttpStatus.CREATED : HttpStatus.OK;
}

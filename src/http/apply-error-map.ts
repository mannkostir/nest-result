import { SetMetadata, UseInterceptors } from '@nestjs/common';
import type { AnyErrorMap } from '../core/error-map.js';
import { ERROR_MAP_METADATA } from './error-map-metadata.js';
import { ResultInterceptor } from './result.interceptor.js';

export function applyErrorMap(
  map: AnyErrorMap,
  target: object,
  key: string | symbol,
  descriptor: PropertyDescriptor,
): void {
  SetMetadata(ERROR_MAP_METADATA, map)(target, key, descriptor);
  UseInterceptors(ResultInterceptor)(target, key, descriptor);
}

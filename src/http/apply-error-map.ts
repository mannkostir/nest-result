import { SetMetadata, UseInterceptors } from '@nestjs/common';
import type { ErrorMapping } from '../core/error-mapping.js';
import { ERROR_MAP_METADATA } from './error-map-metadata.js';
import { ResultInterceptor } from './result.interceptor.js';

export function applyErrorMap(
  mapping: ErrorMapping,
  target: object,
  key: string | symbol,
  descriptor: PropertyDescriptor,
): void {
  SetMetadata(ERROR_MAP_METADATA, mapping)(target, key, descriptor);
  UseInterceptors(ResultInterceptor)(target, key, descriptor);
}

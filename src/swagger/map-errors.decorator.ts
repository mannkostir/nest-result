import { ApiResponse } from '@nestjs/swagger';
import type { AnyErrorMap } from '../core/error-map.js';
import { statusOf } from '../core/resolve-http-error.js';
import { applyErrorMap } from '../http/apply-error-map.js';
import type { MapErrorsDecorator } from '../http/map-errors.decorator.js';

export function MapErrors<const M extends AnyErrorMap>(map: M): MapErrorsDecorator<M> {
  return (target, key, descriptor) => {
    applyErrorMap(map, target, key, descriptor);
    tagsByStatus(map).forEach((tags, status) =>
      ApiResponse({ status, description: tags.join(', ') })(target, key, descriptor),
    );
  };
}

function tagsByStatus(map: AnyErrorMap): ReadonlyMap<number, readonly string[]> {
  return Object.entries(map).reduce((groups, [tag, spec]) => {
    const status = statusOf(spec);
    return new Map(groups).set(status, [...(groups.get(status) ?? []), tag]);
  }, new Map<number, readonly string[]>());
}

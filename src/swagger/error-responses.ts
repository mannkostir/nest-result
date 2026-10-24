import type { Type } from '@nestjs/common';
import {
  getSchemaPath,
  type ContentObject,
  type ExamplesObject,
  type MediaTypeObject,
  type ReferenceObject,
  type SchemaObject,
} from '@nestjs/swagger';
import type { AnyErrorMap, AnyHttpErrorSpec } from '../core/error-map.js';
import { statusOf } from '../core/error-status.js';

export type ErrorBodySchema = Type<unknown> | SchemaObject;

export type ErrorSchemas<K extends string> = { readonly [P in K]?: ErrorBodySchema };

type ErrorResponse = {
  readonly status: number;
  readonly description: string;
  readonly content?: ContentObject;
};

type ErrorResponses = {
  readonly responses: readonly ErrorResponse[];
  readonly models: readonly Type<unknown>[];
};

type DefaultBody = { readonly kind: 'default'; readonly key: string };

type GivenBody = { readonly kind: 'given'; readonly schema: ErrorBodySchema };

type UndocumentedBody = { readonly kind: 'undocumented' };

type DocumentedBody = DefaultBody | GivenBody;

type KeyBody = DocumentedBody | UndocumentedBody;

type StatusDocumentation = { readonly response: ErrorResponse; readonly models: readonly Type<unknown>[] };

type ErrorEntry = readonly [key: string, spec: AnyHttpErrorSpec];

export function errorResponsesOf(
  documented: AnyErrorMap,
  families: readonly string[],
  schemas: ErrorSchemas<string>,
): ErrorResponses {
  const statuses = [...entriesByStatus(documented)].map(([status, entries]) =>
    documentStatus(
      status,
      entries.map(([key]) => key),
      families,
      entries.map(([key, spec]) => bodyOf(key, spec, schemas)),
    ),
  );
  return {
    responses: statuses.map(({ response }) => response),
    models: distinct(statuses.flatMap(({ models }) => models)),
  };
}

function entriesByStatus(map: AnyErrorMap): ReadonlyMap<number, readonly ErrorEntry[]> {
  return Object.entries(map).reduce((groups, entry) => {
    const status = statusOf(entry[1]);
    return new Map(groups).set(status, [...(groups.get(status) ?? []), entry]);
  }, new Map<number, readonly ErrorEntry[]>());
}

function bodyOf(key: string, spec: AnyHttpErrorSpec, schemas: ErrorSchemas<string>): KeyBody {
  const schema = Object.hasOwn(schemas, key) ? schemas[key] : undefined;
  if (schema !== undefined) return { kind: 'given', schema };
  return typeof spec === 'number' ? { kind: 'default', key } : { kind: 'undocumented' };
}

function documentStatus(
  status: number,
  keys: readonly string[],
  families: readonly string[],
  bodies: readonly KeyBody[],
): StatusDocumentation {
  const description = descriptionOf(keys, families);
  if (!bodies.every(isDocumented)) return { response: { status, description }, models: [] };
  const alternatives = alternativesOf(status, bodies, families);
  return {
    response: {
      status,
      description,
      content: { 'application/json': mediaTypeOf(status, alternatives, bodies, families) },
    },
    models: alternatives.filter(isModel),
  };
}

function descriptionOf(keys: readonly string[], families: readonly string[]): string {
  return keys.map((key) => (families.includes(key) ? `${key} (family)` : key)).join(', ');
}

function alternativesOf(
  status: number,
  bodies: readonly DocumentedBody[],
  families: readonly string[],
): readonly ErrorBodySchema[] {
  const defaultSchema = defaultBodySchema(status, defaultKeysOf(bodies), families);
  return distinct(bodies.map((body) => (body.kind === 'default' ? defaultSchema : body.schema)));
}

function mediaTypeOf(
  status: number,
  alternatives: readonly ErrorBodySchema[],
  bodies: readonly DocumentedBody[],
  families: readonly string[],
): MediaTypeObject {
  const examples = defaultExamples(status, defaultKeysOf(bodies).filter((key) => !families.includes(key)));
  return {
    schema: schemaOfAlternatives(alternatives.map(toSchema)),
    ...(Object.keys(examples).length > 0 ? { examples } : {}),
  };
}

function defaultKeysOf(bodies: readonly DocumentedBody[]): readonly string[] {
  return bodies.flatMap((body) => (body.kind === 'default' ? [body.key] : []));
}

function isDocumented(body: KeyBody): body is DocumentedBody {
  return body.kind !== 'undocumented';
}

function isModel(schema: ErrorBodySchema): schema is Type<unknown> {
  return typeof schema === 'function';
}

function defaultBodySchema(status: number, keys: readonly string[], families: readonly string[]): SchemaObject {
  return {
    type: 'object',
    required: ['statusCode', 'code', 'message'],
    properties: {
      statusCode: { type: 'integer', enum: [status] },
      code: keys.some((key) => families.includes(key)) ? { type: 'string' } : { type: 'string', enum: [...keys] },
      message: { type: 'string' },
    },
  };
}

function defaultExamples(status: number, tags: readonly string[]): ExamplesObject {
  return Object.fromEntries(
    tags.map((tag) => [tag, { summary: tag, value: { statusCode: status, code: tag, message: tag } }]),
  );
}

function toSchema(body: ErrorBodySchema): SchemaObject | ReferenceObject {
  return isModel(body) ? { $ref: getSchemaPath(body) } : body;
}

function schemaOfAlternatives(schemas: readonly (SchemaObject | ReferenceObject)[]): SchemaObject | ReferenceObject {
  const [only, ...others] = schemas;
  return only !== undefined && others.length === 0 ? only : { oneOf: [...schemas] };
}

function distinct<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

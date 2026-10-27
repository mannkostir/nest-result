import type { Type } from '@nestjs/common';
import {
  getSchemaPath,
  type ContentObject,
  type ExamplesObject,
  type MediaTypeObject,
  type ReferenceObject,
  type SchemaObject,
} from '@nestjs/swagger';
import type { ErrorBodyFormat } from '../core/error-defaults.js';
import type { AnyErrorMap, AnyHttpErrorSpec } from '../core/error-map.js';
import { statusOf } from '../core/error-status.js';
import { isCustomBodySpec, problemTypeOf, type ProblemType } from '../core/problem-types.js';

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

type DefaultBody = { readonly kind: 'default'; readonly key: string; readonly problemType: ProblemType };

type GivenBody = { readonly kind: 'given'; readonly schema: ErrorBodySchema; readonly statusOnly: boolean };

type UndocumentedBody = { readonly kind: 'undocumented' };

type DocumentedBody = DefaultBody | GivenBody;

type KeyBody = DocumentedBody | UndocumentedBody;

type StatusDocumentation = { readonly response: ErrorResponse; readonly models: readonly Type<unknown>[] };

type StatusBodies = {
  readonly status: number;
  readonly families: readonly string[];
  readonly bodies: readonly DocumentedBody[];
};

type ErrorEntry = readonly [key: string, spec: AnyHttpErrorSpec];

export function errorResponsesOf(
  documented: AnyErrorMap,
  families: readonly string[],
  schemas: ErrorSchemas<string>,
  format: ErrorBodyFormat,
): ErrorResponses {
  const statuses = [...entriesByStatus(documented)].map(([status, entries]) =>
    documentStatus(
      status,
      entries.map(([key]) => key),
      families,
      entries.map(([key, spec]) => bodyOf(key, spec, schemas)),
      format,
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
  if (schema !== undefined) return { kind: 'given', schema, statusOnly: !isCustomBodySpec(spec) };
  return isCustomBodySpec(spec) ? { kind: 'undocumented' } : { kind: 'default', key, problemType: problemTypeOf(spec) };
}

function documentStatus(
  status: number,
  keys: readonly string[],
  families: readonly string[],
  bodies: readonly KeyBody[],
  format: ErrorBodyFormat,
): StatusDocumentation {
  const description = descriptionOf(keys, families);
  if (!bodies.every(isDocumented)) return { response: { status, description }, models: [] };
  const statusBodies = { status, families, bodies };
  return {
    response: {
      status,
      description,
      content: format === 'problem-details' ? problemContentOf(statusBodies) : plainContentOf(statusBodies),
    },
    models: givenSchemasOf(bodies).filter(isModel),
  };
}

function descriptionOf(keys: readonly string[], families: readonly string[]): string {
  return keys.map((key) => (families.includes(key) ? `${key} (family)` : key)).join(', ');
}

function plainContentOf({ status, families, bodies }: StatusBodies): ContentObject {
  const defaultSchema = defaultBodySchema(status, defaultKeysOf(bodies), families);
  const alternatives = distinct(bodies.map((body) => (body.kind === 'default' ? defaultSchema : body.schema)));
  const examples = examplesOf(exampleBodiesOf(bodies, families), ({ key }) => plainExample(status, key));
  return { 'application/json': mediaTypeOf(alternatives, examples) };
}

function problemContentOf({ status, families, bodies }: StatusBodies): ContentObject {
  const problemSchema = problemBodySchema(status, defaultBodiesOf(bodies), families);
  const problems = distinct(bodies.flatMap((body) => problemAlternativesOf(body, problemSchema)));
  const customs = givenSchemasOf(bodies.filter((body) => body.kind === 'given' && !body.statusOnly));
  const examples = examplesOf(exampleBodiesOf(bodies, families), problemExample);
  return {
    ...(problems.length > 0 ? { 'application/problem+json': mediaTypeOf(problems, examples) } : {}),
    ...(customs.length > 0 ? { 'application/json': mediaTypeOf(customs, {}) } : {}),
  };
}

function problemAlternativesOf(body: DocumentedBody, problemSchema: SchemaObject): readonly ErrorBodySchema[] {
  if (body.kind === 'default') return [problemSchema];
  return body.statusOnly ? [body.schema] : [];
}

function mediaTypeOf(alternatives: readonly ErrorBodySchema[], examples: ExamplesObject): MediaTypeObject {
  return {
    schema: schemaOfAlternatives(alternatives.map(toSchema)),
    ...(Object.keys(examples).length > 0 ? { examples } : {}),
  };
}

function defaultBodiesOf(bodies: readonly DocumentedBody[]): readonly DefaultBody[] {
  return bodies.flatMap((body) => (body.kind === 'default' ? [body] : []));
}

function defaultKeysOf(bodies: readonly DocumentedBody[]): readonly string[] {
  return defaultBodiesOf(bodies).map(({ key }) => key);
}

function exampleBodiesOf(bodies: readonly DocumentedBody[], families: readonly string[]): readonly DefaultBody[] {
  return defaultBodiesOf(bodies).filter(({ key }) => !families.includes(key));
}

function givenSchemasOf(bodies: readonly DocumentedBody[]): readonly ErrorBodySchema[] {
  return distinct(bodies.flatMap((body) => (body.kind === 'given' ? [body.schema] : [])));
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
      code: codeSchemaOf(keys, families),
      message: { type: 'string' },
    },
  };
}

function problemBodySchema(status: number, bodies: readonly DefaultBody[], families: readonly string[]): SchemaObject {
  return {
    type: 'object',
    required: ['type', 'title', 'status', 'detail', 'code'],
    properties: {
      type: { type: 'string', enum: [...distinct(bodies.map(({ problemType }) => problemType.type))] },
      title: { type: 'string', enum: [...distinct(bodies.map(({ problemType }) => problemType.title))] },
      status: { type: 'integer', enum: [status] },
      detail: { type: 'string' },
      code: codeSchemaOf(bodies.map(({ key }) => key), families),
      instance: { type: 'string', format: 'uri-reference' },
    },
  };
}

function codeSchemaOf(keys: readonly string[], families: readonly string[]): SchemaObject {
  return keys.some((key) => families.includes(key)) ? { type: 'string' } : { type: 'string', enum: [...keys] };
}

function plainExample(status: number, tag: string): object {
  return { statusCode: status, code: tag, message: tag };
}

function problemExample({ key, problemType: { type, title, status } }: DefaultBody): object {
  return { type, title, status, detail: key, code: key };
}

function examplesOf(bodies: readonly DefaultBody[], exampleOf: (body: DefaultBody) => object): ExamplesObject {
  return Object.fromEntries(bodies.map((body) => [body.key, { summary: body.key, value: exampleOf(body) }]));
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

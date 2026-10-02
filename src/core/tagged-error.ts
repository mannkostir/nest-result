export type TaggedErrorPayload = object & {
  readonly message?: string;
  readonly cause?: unknown;
  readonly _tag?: never;
  readonly _family?: never;
  readonly name?: never;
  readonly stack?: never;
};

export type TaggedErrorOptions<Family extends string> = { readonly family?: Family };

type ConstructorArgs<P> = {} extends P ? [payload?: P] : [payload: P];

type FamilyField<Family extends string> = [Family] extends [never] ? {} : { readonly _family: Family };

export type TaggedErrorInstance<Tag extends string, P, Family extends string = never> = Error & {
  readonly _tag: Tag;
} & FamilyField<Family> &
  Readonly<Omit<P, 'message' | 'cause'>>;

export type TaggedErrorClass<Tag extends string, Family extends string = never> = new <
  P extends TaggedErrorPayload = {},
>(
  ...args: ConstructorArgs<P>
) => TaggedErrorInstance<Tag, P, Family>;

const reservedPayloadKeys: ReadonlySet<PropertyKey> = new Set([
  'message',
  'cause',
  '_tag',
  '_family',
  'name',
  'stack',
  '__proto__',
]);

export function TaggedError<const Tag extends string, const Family extends string = never>(
  tag: Tag,
  options: TaggedErrorOptions<Family> = {},
): TaggedErrorClass<Tag, Family> {
  class TaggedErrorBase extends Error {
    readonly _tag: Tag;

    constructor(payload: TaggedErrorPayload = {}) {
      super(payload.message ?? tag, errorOptionsOf(payload));
      Object.assign(this, ownFieldsOf(payload), familyFieldOf(options.family));
      this._tag = tag;
    }
  }
  Object.defineProperty(TaggedErrorBase.prototype, 'name', { value: tag, writable: true, configurable: true });
  return TaggedErrorBase as unknown as TaggedErrorClass<Tag, Family>;
}

function errorOptionsOf(payload: TaggedErrorPayload): ErrorOptions | undefined {
  return 'cause' in payload ? { cause: payload.cause } : undefined;
}

function ownFieldsOf(payload: object): object {
  return Object.fromEntries(
    Reflect.ownKeys(payload)
      .filter((key) => !reservedPayloadKeys.has(key) && Object.prototype.propertyIsEnumerable.call(payload, key))
      .map((key) => [key, Reflect.get(payload, key)]),
  );
}

function familyFieldOf(family: string | undefined): object {
  return family === undefined ? {} : { _family: family };
}

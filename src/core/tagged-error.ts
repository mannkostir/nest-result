export type TaggedErrorPayload = object & {
  readonly message?: string;
  readonly _tag?: never;
  readonly name?: never;
};

type ConstructorArgs<P> = {} extends P ? [payload?: P] : [payload: P];

export type TaggedErrorInstance<Tag extends string, P> = Error & {
  readonly _tag: Tag;
} & Readonly<Omit<P, 'message'>>;

export type TaggedErrorClass<Tag extends string> = new <P extends TaggedErrorPayload = {}>(
  ...args: ConstructorArgs<P>
) => TaggedErrorInstance<Tag, P>;

export function TaggedError<const Tag extends string>(tag: Tag): TaggedErrorClass<Tag> {
  class TaggedErrorBase extends Error {
    readonly _tag: Tag;

    constructor(payload?: TaggedErrorPayload) {
      super(payload?.message ?? tag);
      Object.assign(this, payload);
      this._tag = tag;
      this.name = tag;
    }
  }
  return TaggedErrorBase as TaggedErrorClass<Tag>;
}

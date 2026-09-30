export type Tagged = { readonly _tag: string };

export type TagOf<E> = E extends { readonly _tag: infer T extends string } ? T : never;

export type UntaggedMember<E> = E extends { readonly _tag: infer T }
  ? T extends string
    ? string extends T
      ? E
      : never
    : E
  : E;

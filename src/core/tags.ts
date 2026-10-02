export type Tagged = { readonly _tag: string; readonly _family?: string };

export type TagOf<E> = E extends { readonly _tag: infer T extends string } ? T : never;

export type FamilyOf<E> = E extends { readonly _family: infer F extends string } ? F : never;

export type ErrorKeyOf<E> = TagOf<E> | FamilyOf<E>;

type IsLiteral<S> = S extends string ? (string extends S ? false : true) : false;

type HasLiteralFamilyOrNone<E> = E extends { readonly _family: infer F } ? IsLiteral<F> : true;

export type UntaggedMember<E> = E extends { readonly _tag: infer T }
  ? IsLiteral<T> extends true
    ? HasLiteralFamilyOrNone<E> extends true
      ? never
      : E
    : E
  : E;

export type MembersWithKey<E, K> = E extends unknown
  ? TagOf<E> extends K
    ? E
    : [FamilyOf<E>] extends [never]
      ? never
      : FamilyOf<E> extends K
        ? E
        : never
  : never;

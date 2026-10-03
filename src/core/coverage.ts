import type { FamilyOf, TagOf } from './tags.js';

type HasFamilyIn<E, K> = [FamilyOf<E>] extends [never] ? false : FamilyOf<E> extends K ? true : false;

type TagIn<E, K> = TagOf<E> extends K ? true : false;

type CoveredBy<E, K> = TagIn<E, K> extends true ? true : HasFamilyIn<E, K>;

type ResolvingKey<E, Keys> = TagIn<E, Keys> extends true
  ? TagOf<E>
  : HasFamilyIn<E, Keys> extends true
    ? FamilyOf<E>
    : never;

type ResolvedBy<E, Keys, Key> = E extends unknown
  ? [ResolvingKey<E, Keys>] extends [never]
    ? never
    : ResolvingKey<E, Keys> extends Key
      ? E
      : never
  : never;

export type AmbiguousKeys<E> = Extract<TagOf<E>, FamilyOf<E>>;

export type MissingKeys<E, Keys> = E extends unknown
  ? CoveredBy<E, Keys> extends true
    ? never
    : [FamilyOf<E>] extends [never]
      ? TagOf<E>
      : FamilyOf<E>
  : never;

export type StaleKeys<E, Keys extends PropertyKey> = {
  [K in Keys]: [ResolvedBy<E, Keys, K>] extends [never] ? K : never;
}[Keys];

export type UsedDefaultKeys<E, RouteKeys, DefaultKeys extends PropertyKey> = {
  [K in DefaultKeys]: [ResolvedBy<Exclude<E, ResolvedBy<E, RouteKeys, RouteKeys>>, DefaultKeys, K>] extends [never]
    ? never
    : K;
}[DefaultKeys];

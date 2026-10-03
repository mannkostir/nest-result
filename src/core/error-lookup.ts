export type ErrorIdentity = { readonly tag: string; readonly family: string | undefined };

export function readErrorIdentity(error: unknown): ErrorIdentity | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { _tag: tag, _family: family } = error as { readonly _tag?: unknown; readonly _family?: unknown };
  if (typeof tag !== 'string') return undefined;
  return { tag, family: typeof family === 'string' ? family : undefined };
}

export function lookupByIdentity<V>(
  identity: ErrorIdentity,
  tables: readonly Readonly<Record<string, V>>[],
): V | undefined {
  return tables
    .flatMap((table) => [ownValue(table, identity.tag), ownValue(table, identity.family)])
    .find((value) => value !== undefined);
}

function ownValue<V>(table: Readonly<Record<string, V>>, key: string | undefined): V | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}

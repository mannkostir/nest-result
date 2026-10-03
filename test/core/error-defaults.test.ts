import { describe, expect, it } from 'vitest';
import { errorDefaults, InvalidErrorStatusError } from '../../src/index.js';

describe('errorDefaults', () => {
  it('returns the given mappings', () => {
    expect(errorDefaults({ NotFound: 404, Conflict: 409 })).toEqual({ NotFound: 404, Conflict: 409 });
  });

  it('returns a frozen copy', () => {
    expect(Object.isFrozen(errorDefaults({ NotFound: 404 }))).toBe(true);
  });

  it('rejects a status outside 400–599 that a cast smuggled in', () => {
    const smuggled = { NotFound: 302 } as unknown as { NotFound: 404 };
    expect(() => errorDefaults(smuggled)).toThrow(InvalidErrorStatusError);
  });
});

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

  it('returns the given mappings under the problem details format', () => {
    expect(errorDefaults({ NotFound: 404, Conflict: 409 }, { body: 'problem-details' })).toEqual({ NotFound: 404, Conflict: 409 });
  });

  it('returns a frozen copy under the problem details format', () => {
    expect(Object.isFrozen(errorDefaults({ NotFound: 404 }, { body: 'problem-details' }))).toBe(true);
  });

  it('rejects a smuggled out-of-range status under the problem details format', () => {
    const smuggled = { NotFound: 302 } as unknown as { NotFound: 404 };
    expect(() => errorDefaults(smuggled, { body: 'problem-details' })).toThrow(InvalidErrorStatusError);
  });
});

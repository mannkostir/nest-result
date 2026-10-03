import { describe, expect, it } from 'vitest';
import { assertErrorStatuses, statusOf } from '../../src/core/error-status.js';
import { InvalidErrorStatusError } from '../../src/index.js';

describe('assertErrorStatuses', () => {
  it('accepts statuses from 400 to 599', () => {
    expect(() => assertErrorStatuses({ First: 400, Last: { status: 599, body: () => ({}) } })).not.toThrow();
  });

  it('rejects a status below 400', () => {
    expect(() => assertErrorStatuses({ Moved: 302 })).toThrow(InvalidErrorStatusError);
  });

  it('rejects a status above 599', () => {
    expect(() => assertErrorStatuses({ Odd: 600 })).toThrow(InvalidErrorStatusError);
  });

  it('rejects a status that is not an integer', () => {
    expect(() => assertErrorStatuses({ Odd: 404.5 })).toThrow(InvalidErrorStatusError);
  });

  it('rejects an out-of-range status inside an object spec', () => {
    expect(() => assertErrorStatuses({ Moved: { status: 302, body: () => ({}) } })).toThrow(InvalidErrorStatusError);
  });

  it('names the key and the status it rejects', () => {
    expect(() => assertErrorStatuses({ Fine: 404, Moved: 302 })).toThrow(
      InvalidErrorStatusError.forKey('Moved', 302).message,
    );
  });
});

describe('statusOf', () => {
  it('reads the status of a numeric spec', () => {
    expect(statusOf(418)).toBe(418);
  });

  it('reads the status of an object spec', () => {
    expect(statusOf({ status: 409, body: () => ({}) })).toBe(409);
  });
});

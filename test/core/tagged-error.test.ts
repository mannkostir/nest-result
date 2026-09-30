import { describe, expect, it } from 'vitest';
import { TaggedError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}

class Unauthorized extends TaggedError('Unauthorized') {}

class Explained extends TaggedError('Explained')<{ message: string }> {}

describe('TaggedError', () => {
  it('exposes its tag', () => {
    expect(new DealNotFound({ dealId: '42' })._tag).toBe('DealNotFound');
  });

  it('exposes payload fields on the instance', () => {
    expect(new DealNotFound({ dealId: '42' }).dealId).toBe('42');
  });

  it('is an Error', () => {
    expect(new Unauthorized()).toBeInstanceOf(Error);
  });

  it('is an instance of its own subclass', () => {
    expect(new Unauthorized()).toBeInstanceOf(Unauthorized);
  });

  it('uses the tag as its name', () => {
    expect(new Unauthorized().name).toBe('Unauthorized');
  });

  it('uses the tag as its default message', () => {
    expect(new Unauthorized().message).toBe('Unauthorized');
  });

  it('uses the payload message when one is given', () => {
    expect(new Explained({ message: 'Token expired' }).message).toBe('Token expired');
  });

  it('captures a stack trace', () => {
    expect(new Unauthorized().stack).toContain('Unauthorized');
  });

  it('keeps its tag when a payload smuggles in a _tag through a cast', () => {
    const forged = new DealNotFound({ dealId: '1', _tag: 'Forged' } as unknown as { dealId: string });
    expect(forged._tag).toBe('DealNotFound');
  });

  it('keeps its name when a payload smuggles in a name through a cast', () => {
    const forged = new DealNotFound({ dealId: '1', name: 'Forged' } as unknown as { dealId: string });
    expect(forged.name).toBe('DealNotFound');
  });
});

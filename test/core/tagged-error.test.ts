import { describe, expect, it } from 'vitest';
import { TaggedError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound')<{ dealId: string }> {}

class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' })<{ taskId: string }> {}

class Unauthorized extends TaggedError('Unauthorized') {}

class Explained extends TaggedError('Explained')<{ message: string }> {}

class Wrapped extends TaggedError('Wrapped')<{ cause: unknown }> {}

describe('TaggedError', () => {
  it('exposes its tag', () => {
    expect(new DealNotFound({ dealId: '42' })._tag).toBe('DealNotFound');
  });

  it('exposes its family', () => {
    expect(new TaskNotFound({ taskId: '1' })._family).toBe('NotFound');
  });

  it('has no family property when none is declared', () => {
    expect(Object.hasOwn(new Unauthorized(), '_family')).toBe(false);
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

  it('keeps name off the instance', () => {
    expect(Object.hasOwn(new Unauthorized(), 'name')).toBe(false);
  });

  it('uses the tag as its default message', () => {
    expect(new Unauthorized().message).toBe('Unauthorized');
  });

  it('uses the payload message when one is given', () => {
    expect(new Explained({ message: 'Token expired' }).message).toBe('Token expired');
  });

  it('keeps message and cause out of its enumerable fields', () => {
    expect(Object.keys(new Wrapped({ cause: new Error('root') }))).toEqual(['_tag']);
  });

  it('passes a payload cause through as Error.cause', () => {
    const root = new Error('root');
    expect(new Wrapped({ cause: root }).cause).toBe(root);
  });

  it('serializes to its identity and payload fields', () => {
    expect(JSON.parse(JSON.stringify(new TaskNotFound({ taskId: '1' })))).toEqual({
      _tag: 'TaskNotFound',
      _family: 'NotFound',
      taskId: '1',
    });
  });

  it('starts its stack trace with the class name and message', () => {
    expect(new Explained({ message: 'Token expired' }).stack?.split('\n')[0]).toBe('Explained: Token expired');
  });

  it('keeps its tag when a payload smuggles in a _tag through a cast', () => {
    const forged = new DealNotFound({ dealId: '1', _tag: 'Forged' } as unknown as { dealId: string });
    expect(forged._tag).toBe('DealNotFound');
  });

  it('keeps its family when a payload smuggles in a _family through a cast', () => {
    const forged = new TaskNotFound({ taskId: '1', _family: 'Forged' } as unknown as { taskId: string });
    expect(forged._family).toBe('NotFound');
  });

  it('keeps its name when a payload smuggles in a name through a cast', () => {
    const forged = new DealNotFound({ dealId: '1', name: 'Forged' } as unknown as { dealId: string });
    expect(forged.name).toBe('DealNotFound');
  });

  it('keeps a smuggled stack off the instance', () => {
    const forged = new DealNotFound({ dealId: '1', stack: 'forged' } as unknown as { dealId: string });
    expect(forged.stack).not.toBe('forged');
  });

  it('copies a symbol-keyed payload field onto the instance', () => {
    const marker = Symbol('marker');
    const error = new DealNotFound({ dealId: '1', [marker]: 'kept' } as { dealId: string });
    expect((error as unknown as Record<symbol, string>)[marker]).toBe('kept');
  });

  it('keeps its prototype when a payload smuggles in an own __proto__ key', () => {
    const forged = new DealNotFound(JSON.parse('{"dealId":"1","__proto__":{"forged":true}}') as { dealId: string });
    expect(Object.getPrototypeOf(forged)).toBe(DealNotFound.prototype);
  });
});

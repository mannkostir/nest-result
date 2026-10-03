import { describe, expect, it } from 'vitest';
import { matchError, TaggedError, UnmappedErrorTagError, UntaggedErrorValueError } from '../../src/index.js';

class DealNotFound extends TaggedError('DealNotFound', { family: 'NotFound' })<{ dealId: string }> {}
class TaskNotFound extends TaggedError('TaskNotFound', { family: 'NotFound' }) {}
class DealArchived extends TaggedError('DealArchived') {}

type DealError = DealNotFound | TaskNotFound | DealArchived;

const describeError = (error: DealError): string =>
  matchError(error, { NotFound: (e) => `missing ${e._tag}`, DealArchived: () => 'archived' });

describe('matchError', () => {
  it('calls the handler for the error tag', () => {
    expect(describeError(new DealArchived())).toBe('archived');
  });

  it('calls the family handler for an error without its own tag handler', () => {
    expect(describeError(new TaskNotFound())).toBe('missing TaskNotFound');
  });

  it('prefers a tag handler over its family handler', () => {
    const describeDeal = (error: DealError): string =>
      matchError(error, { DealNotFound: (e) => e.dealId, NotFound: () => 'family', DealArchived: () => 'old' });
    expect(describeDeal(new DealNotFound({ dealId: '7' }))).toBe('7');
  });

  it('passes the error itself to the handler', () => {
    const error = new DealArchived();
    expect(matchError(error, { DealArchived: (e) => e })).toBe(error);
  });

  it('matches a plain tagged object', () => {
    expect(matchError({ _tag: 'RateLimited' } as const, { RateLimited: () => 'slow down' })).toBe('slow down');
  });

  it('lets an exception thrown by a handler propagate unchanged', () => {
    const boom = new Error('boom');
    expect(() =>
      matchError(new DealArchived(), {
        DealArchived: () => {
          throw boom;
        },
      }),
    ).toThrow(boom);
  });

  it('throws UnmappedErrorTagError when a cast hides an unhandled tag', () => {
    const forged = { _tag: 'Forged' } as unknown as DealArchived;
    expect(() => matchError(forged, { DealArchived: () => 1 })).toThrow(UnmappedErrorTagError);
  });

  it('does not resolve tags that only exist on Object.prototype', () => {
    const forged = { _tag: 'toString' } as unknown as DealArchived;
    expect(() => matchError(forged, { DealArchived: () => 1 })).toThrow(UnmappedErrorTagError);
  });

  it('throws UntaggedErrorValueError when a cast hides an untagged value', () => {
    const forged = new Error('plain') as unknown as DealArchived;
    expect(() => matchError(forged, { DealArchived: () => 1 })).toThrow(UntaggedErrorValueError);
  });
});

import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { ExpressAdapter } from '@nestjs/platform-express';
import { describe, expect, it, vi } from 'vitest';
import { ProblemDetailsException, ProblemDetailsFilter } from '../../src/index.js';

function rpcHost(): ExecutionContextHost {
  const host = new ExecutionContextHost([]);
  host.setType('rpc');
  return host;
}

function thrownBy(act: () => void): unknown {
  try {
    act();
  } catch (thrown: unknown) {
    return thrown;
  }
  return undefined;
}

describe('ProblemDetailsFilter on a non-HTTP host', () => {
  it('rethrows the exception unchanged', () => {
    const filter = new ProblemDetailsFilter(new ExpressAdapter());
    const exception = new ProblemDetailsException({ status: 404 }, 404);
    expect(thrownBy(() => filter.catch(exception, rpcHost()))).toBe(exception);
  });

  it('sets no header', () => {
    const adapter = new ExpressAdapter();
    const setHeader = vi.spyOn(adapter, 'setHeader');
    const filter = new ProblemDetailsFilter(adapter);
    thrownBy(() => filter.catch(new ProblemDetailsException({ status: 404 }, 404), rpcHost()));
    expect(setHeader).not.toHaveBeenCalled();
  });
});

import { HttpException } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { ExpressAdapter } from '@nestjs/platform-express';
import { errAsync, type ResultAsync } from 'neverthrow';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { errorDefaults, MapErrors, ProblemDetailsException, ResultInterceptor, TaggedError } from '../../src/index.js';

class BookNotFound extends TaggedError('BookNotFound', { family: 'NotFound' })<{ message: string }> {}

const MapProblemErrors = MapErrors.withDefaults(errorDefaults({ NotFound: 404 }, { body: 'problem-details' }));

class BooksHandler {
  @MapProblemErrors({})
  find(): ResultAsync<number, BookNotFound> {
    return errAsync(new BookNotFound({ message: 'Book not found' }));
  }
}

function rpcContext(): ExecutionContextHost {
  const context = new ExecutionContextHost([], BooksHandler, BooksHandler.prototype.find);
  context.setType('rpc');
  return context;
}

function expressAdapterHost(): HttpAdapterHost {
  const adapterHost = new HttpAdapterHost();
  adapterHost.httpAdapter = new ExpressAdapter();
  return adapterHost;
}

async function rpcRejection(): Promise<unknown> {
  const interceptor = new ResultInterceptor(new Reflector(), expressAdapterHost());
  const handled = interceptor.intercept(rpcContext(), { handle: () => of(new BooksHandler().find()) });
  return lastValueFrom(handled).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
}

describe('ResultInterceptor in a non-HTTP context under problem details defaults', () => {
  it('rejects with an HttpException', async () => {
    expect(await rpcRejection()).toBeInstanceOf(HttpException);
  });

  it('rejects with no ProblemDetailsException', async () => {
    expect(await rpcRejection()).not.toBeInstanceOf(ProblemDetailsException);
  });
});

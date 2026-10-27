import { type ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ProblemDetailsException } from './problem-details.exception.js';

@Catch(ProblemDetailsException)
export class ProblemDetailsFilter extends BaseExceptionFilter<ProblemDetailsException> {
  override catch(exception: ProblemDetailsException, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;
    const adapter = this.applicationRef ?? this.httpAdapterHost?.httpAdapter;
    adapter?.setHeader(host.switchToHttp().getResponse(), 'Content-Type', 'application/problem+json');
    super.catch(exception, host);
  }
}

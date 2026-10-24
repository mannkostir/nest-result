import { type ArgumentsHost, Catch, type ExceptionFilter, Inject, Injectable } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';

@Injectable()
export class ExceptionRecorder {
  private recorded: unknown;

  record(exception: unknown): void {
    this.recorded = exception;
  }

  get last(): unknown {
    return this.recorded;
  }
}

@Catch()
export class RecordingFilter implements ExceptionFilter {
  constructor(
    @Inject(ExceptionRecorder) private readonly recorder: ExceptionRecorder,
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    this.recorder.record(exception);
    this.adapterHost.httpAdapter.reply(host.switchToHttp().getResponse(), { statusCode: 500 }, 500);
  }
}

export const recordingProviders = [ExceptionRecorder, { provide: APP_FILTER, useClass: RecordingFilter }];

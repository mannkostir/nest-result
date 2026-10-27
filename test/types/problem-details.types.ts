import type { ExceptionFilter, HttpException } from '@nestjs/common';
import { expectTypeOf } from 'expect-type';
import type { ProblemDetailsException, ProblemDetailsFilter } from '../../src/index.js';

expectTypeOf<ProblemDetailsException>().toExtend<HttpException>();

expectTypeOf<ConstructorParameters<typeof ProblemDetailsException>>().toEqualTypeOf<
  ConstructorParameters<typeof HttpException>
>();

expectTypeOf<ProblemDetailsFilter>().toExtend<ExceptionFilter>();

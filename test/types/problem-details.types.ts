import type { HttpException } from '@nestjs/common';
import { expectTypeOf } from 'expect-type';
import type { ProblemDetailsException } from '../../src/index.js';

expectTypeOf<ProblemDetailsException>().toExtend<HttpException>();

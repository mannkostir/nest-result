import { Reflector } from '@nestjs/core';
import { expectTypeOf } from 'expect-type';
import { ResultInterceptor } from '../../src/index.js';

expectTypeOf(new ResultInterceptor(new Reflector())).toEqualTypeOf<ResultInterceptor>();

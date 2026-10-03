import type { ResultAsync } from 'neverthrow';
import {
  errorDefaults,
  MapErrors,
  matchError,
  TaggedError,
  toHttp,
} from '../../src/index.js';
import { MapErrors as DocumentedMapErrors } from '../../src/swagger/index.js';

class E0 extends TaggedError('E0', { family: 'NotFound' }) {}
class E1 extends TaggedError('E1', { family: 'Conflict' }) {}
class E2 extends TaggedError('E2', { family: 'Forbidden' }) {}
class E3 extends TaggedError('E3', { family: 'Invalid' }) {}
class E4 extends TaggedError('E4', { family: 'Unavailable' }) {}
class E5 extends TaggedError('E5', { family: 'NotFound' }) {}
class E6 extends TaggedError('E6', { family: 'Conflict' }) {}
class E7 extends TaggedError('E7', { family: 'Forbidden' }) {}
class E8 extends TaggedError('E8', { family: 'Invalid' }) {}
class E9 extends TaggedError('E9', { family: 'Unavailable' }) {}
class E10 extends TaggedError('E10', { family: 'NotFound' }) {}
class E11 extends TaggedError('E11', { family: 'Conflict' }) {}
class E12 extends TaggedError('E12', { family: 'Forbidden' }) {}
class E13 extends TaggedError('E13', { family: 'Invalid' }) {}
class E14 extends TaggedError('E14', { family: 'Unavailable' }) {}
class E15 extends TaggedError('E15', { family: 'NotFound' }) {}
class E16 extends TaggedError('E16', { family: 'Conflict' }) {}
class E17 extends TaggedError('E17', { family: 'Forbidden' }) {}
class E18 extends TaggedError('E18', { family: 'Invalid' }) {}
class E19 extends TaggedError('E19', { family: 'Unavailable' }) {}
class E20 extends TaggedError('E20', { family: 'NotFound' }) {}
class E21 extends TaggedError('E21', { family: 'Conflict' }) {}
class E22 extends TaggedError('E22', { family: 'Forbidden' }) {}
class E23 extends TaggedError('E23', { family: 'Invalid' }) {}
class E24 extends TaggedError('E24', { family: 'Unavailable' }) {}

type AllErrors =
  | E0
  | E1
  | E2
  | E3
  | E4
  | E5
  | E6
  | E7
  | E8
  | E9
  | E10
  | E11
  | E12
  | E13
  | E14
  | E15
  | E16
  | E17
  | E18
  | E19
  | E20
  | E21
  | E22
  | E23
  | E24;

declare const result: ResultAsync<number, AllErrors>;
declare const error: AllErrors;

const defaults = errorDefaults({
  NotFound: 404,
  Conflict: 409,
  Forbidden: 403,
  Invalid: 422,
  Unavailable: 503,
  Extra: 418,
});
const DocumentedFamilyErrors = DocumentedMapErrors.withDefaults(defaults);

toHttp(result, { E0: 410 }, defaults);

matchError(error, {
  E0: () => 'gone',
  NotFound: () => 'not found',
  Conflict: () => 'conflict',
  Forbidden: () => 'forbidden',
  Invalid: () => 'invalid',
  Unavailable: () => 'unavailable',
});

export class FamilyScaleController {
  @DocumentedFamilyErrors(
    { E0: 410 },
    { uses: ['NotFound', 'Conflict', 'Forbidden', 'Invalid', 'Unavailable'] },
  )
  documented(): ResultAsync<number, AllErrors> {
    return result;
  }

  @MapErrors({
    E0: 404,
    E1: 409,
    E2: 403,
    E3: 422,
    E4: 503,
    E5: 404,
    E6: 409,
    E7: 403,
    E8: 422,
    E9: 503,
    E10: 404,
    E11: 409,
    E12: 403,
    E13: 422,
    E14: 503,
    E15: 404,
    E16: 409,
    E17: 403,
    E18: 422,
    E19: 503,
    E20: 404,
    E21: 409,
    E22: 403,
    E23: 422,
    E24: 503,
  })
  explicit(): ResultAsync<number, AllErrors> {
    return result;
  }
}

import { beforeAll, describe, expect, it } from 'vitest';
import { compileFixtures } from './compile-fixtures.js';

describe('compiler diagnostics for common mistakes', () => {
  let diagnostics: ReadonlyMap<string, string>;

  beforeAll(() => {
    diagnostics = compileFixtures();
  });

  it('names the missing tag when toHttp omits a mapping', () => {
    expect(diagnostics.get('to-http-missing-key')).toContain('MissingErrorMapKeys<"AccessDenied">');
  });

  it('names the stale key when toHttp maps a tag that cannot occur', () => {
    expect(diagnostics.get('to-http-stale-key')).toContain('StaleErrorMapKeys<"Stale">');
  });

  it('names the untagged error when toHttp receives one', () => {
    expect(diagnostics.get('to-http-untagged')).toContain('UntaggedErrorsCannotBeMapped<Error>');
  });

  it('names the missing tag when MapErrors omits a mapping', () => {
    expect(diagnostics.get('decorator-missing-key')).toContain('MissingErrorMapKeys<"AccessDenied">');
  });

  it('names the stale key when MapErrors maps a tag that cannot occur', () => {
    expect(diagnostics.get('decorator-stale-key')).toContain('StaleErrorMapKeys<"Stale">');
  });

  it('names the untagged error when MapErrors decorates a method returning one', () => {
    expect(diagnostics.get('decorator-untagged')).toContain('UntaggedErrorsCannotBeMapped<Error>');
  });

  it('flags a body function annotated with the wrong error type', () => {
    expect(diagnostics.get('decorator-body-mismatch')).toContain('ErrorBodyParameterMismatch<');
  });

  it('names the missing family when MapErrors covers none of its members', () => {
    expect(diagnostics.get('decorator-missing-family')).toContain('MissingErrorMapKeys<"NotFound">');
  });

  it('names a key that is a tag in one error and a family in another', () => {
    expect(diagnostics.get('to-http-ambiguous')).toContain('AmbiguousErrorKeys<"NotFound">');
  });

  it('names a family key that every member overrides as stale', () => {
    expect(diagnostics.get('to-http-shadowed-family')).toContain('StaleErrorMapKeys<"NotFound">');
  });

  it('reports nothing outside the fixtures', () => {
    expect(diagnostics.has('unknown')).toBe(false);
  });
});

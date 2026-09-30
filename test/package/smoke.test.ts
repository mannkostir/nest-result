import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function run(args: readonly string[]): string {
  return execFileSync(process.execPath, args, { encoding: 'utf8' }).trim();
}

describe('built package', () => {
  it('shares one implementation between require and import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const required = [require('nest-result').MapErrors, require('nest-result').UnmappedErrorTagError, require('nest-result/transactional').TransactionalResult]; const imported = [(await import('nest-result')).MapErrors, (await import('nest-result')).UnmappedErrorTagError, (await import('nest-result/transactional')).TransactionalResult]; console.log(required.every((value, index) => value === imported[index]))",
    ]);
    expect(output).toBe('true');
  });

  it('refuses deep imports into dist', () => {
    const output = run([
      '-e',
      "try { require('nest-result/dist/index.js'); console.log('resolved') } catch (error) { console.log(error.code) }",
    ]);
    expect(output).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });

  it('loads every entry point through require', () => {
    const output = run([
      '-e',
      "const core = require('nest-result'); const swagger = require('nest-result/swagger'); const tx = require('nest-result/transactional'); console.log([typeof core.MapErrors, typeof core.TaggedError, typeof swagger.MapErrors, typeof tx.TransactionalResult].join(','))",
    ]);
    expect(output).toBe('function,function,function,function');
  });

  it('loads every entry point through import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "const core = await import('nest-result'); const swagger = await import('nest-result/swagger'); const tx = await import('nest-result/transactional'); console.log([typeof core.ResultModule, typeof core.toHttp, typeof swagger.MapErrors, typeof tx.withResultTransaction].join(','))",
    ]);
    expect(output).toBe('function,function,function,function');
  });
});

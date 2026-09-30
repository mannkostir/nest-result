import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function run(args: readonly string[]): string {
  return execFileSync(process.execPath, args, { encoding: 'utf8' }).trim();
}

describe('built package', () => {
  it('shares one index implementation between require and import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const required = [require('nest-result').MapErrors, require('nest-result').UnmappedErrorTagError]; const imported = [(await import('nest-result')).MapErrors, (await import('nest-result')).UnmappedErrorTagError]; console.log(required.every((value, index) => value === imported[index]))",
    ]);
    expect(output).toBe('true');
  });

  it('loads the transactional entry point through require and import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); console.log([typeof require('nest-result/transactional').TransactionalResult, typeof (await import('nest-result/transactional')).TransactionalResult].join(','))",
    ]);
    expect(output).toBe('function,function');
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

  it('commits a transactional result in a commonjs host', () => {
    const output = run([
      '-e',
      [
        "require('reflect-metadata');",
        "const { NestFactory } = require('@nestjs/core');",
        "const { Module } = require('@nestjs/common');",
        "const { ClsModule } = require('nestjs-cls');",
        "const { ClsPluginTransactional, NoOpTransactionalAdapter } = require('@nestjs-cls/transactional');",
        "const { ok } = require('neverthrow');",
        "const { TransactionalResult } = require('nest-result/transactional');",
        'class Deals { async close() { return ok(1); } }',
        "const descriptor = Object.getOwnPropertyDescriptor(Deals.prototype, 'close');",
        "TransactionalResult()(Deals.prototype, 'close', descriptor);",
        "Object.defineProperty(Deals.prototype, 'close', descriptor);",
        'class AppModule {}',
        'Module({ imports: [ClsModule.forRoot({ global: true, plugins: [new ClsPluginTransactional({ adapter: new NoOpTransactionalAdapter({ tx: {} }) })] })], providers: [{ provide: Deals, useClass: Deals }] })(AppModule);',
        '(async () => {',
        '  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });',
        '  const result = await app.get(Deals).close();',
        '  console.log(result.isOk());',
        '  await app.close();',
        '})();',
      ].join('\n'),
    ]);
    expect(output).toBe('true');
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

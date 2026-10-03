import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function run(args: readonly string[]): string {
  return execFileSync(process.execPath, args, { encoding: 'utf8' }).trim();
}

describe('built package', () => {
  it('shares one MapErrors between require and import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); console.log(require('nest-result').MapErrors === (await import('nest-result')).MapErrors)",
    ]);
    expect(output).toBe('true');
  });

  it('shares one UnmappedErrorTagError between require and import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); console.log(require('nest-result').UnmappedErrorTagError === (await import('nest-result')).UnmappedErrorTagError)",
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

  it.each([
    ['nest-result', 'MapErrors'],
    ['nest-result/swagger', 'MapErrors'],
    ['nest-result/transactional', 'TransactionalResult'],
    ['nest-result/unit-of-work', 'withResultUnitOfWork'],
  ])('loads %s through require', (entry, name) => {
    const output = run(['-e', `console.log(typeof require('${entry}').${name})`]);
    expect(output).toBe('function');
  });

  it('shares one unit-of-work implementation between require and import', () => {
    const output = run([
      '--input-type=module',
      '-e',
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); console.log(require('nest-result/unit-of-work').withResultUnitOfWork === (await import('nest-result/unit-of-work')).withResultUnitOfWork)",
    ]);
    expect(output).toBe('true');
  });

  it('rolls back an Err through the unit-of-work entry point in a commonjs host', () => {
    const output = run([
      '-e',
      [
        "const { err } = require('neverthrow');",
        "const { withResultUnitOfWork } = require('nest-result/unit-of-work');",
        'const decisions = [];',
        'const uow = { run: async (work, options) => { const result = await work({}); decisions.push(options.commitWhen(result)); return result; } };',
        "withResultUnitOfWork(uow, async () => err('rejected')).then((result) => console.log([result.isErr(), decisions[0]].join(',')));",
      ].join('\n'),
    ]);
    expect(output).toBe('true,false');
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

  it.each([
    ['nest-result', 'toHttp'],
    ['nest-result/swagger', 'MapErrors'],
    ['nest-result/transactional', 'withResultTransaction'],
    ['nest-result/unit-of-work', 'withResultUnitOfWork'],
  ])('loads %s through import', (entry, name) => {
    const output = run(['--input-type=module', '-e', `console.log(typeof (await import('${entry}')).${name})`]);
    expect(output).toBe('function');
  });
});

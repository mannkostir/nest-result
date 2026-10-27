import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { installedNestMajor, problemDetailsMediaType } from '../support/nest-version.js';

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

  it.each(['ProblemDetailsException', 'ProblemDetailsFilter'])('shares one %s between require and import', (name) => {
    const output = run([
      '--input-type=module',
      '-e',
      `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const required = require('nest-result').${name}; console.log([typeof required, required === (await import('nest-result')).${name}].join(','))`,
    ]);
    expect(output).toBe('function,true');
  });

  it('sends a problem details Err through ProblemDetailsFilter in a commonjs host', () => {
    const output = run([
      '-e',
      [
        "require('reflect-metadata');",
        "const { APP_FILTER, NestFactory } = require('@nestjs/core');",
        "const { Controller, Get, Module } = require('@nestjs/common');",
        "const { errAsync } = require('neverthrow');",
        "const { errorDefaults, MapErrors, ProblemDetailsFilter, ResultModule, TaggedError } = require('nest-result');",
        "class BookNotFound extends TaggedError('BookNotFound', { family: 'NotFound' }) {}",
        'class Books { find() { return errAsync(new BookNotFound()); } }',
        "const descriptor = Object.getOwnPropertyDescriptor(Books.prototype, 'find');",
        "MapErrors.withDefaults(errorDefaults({ NotFound: 404 }, { body: 'problem-details' }))({})(Books.prototype, 'find', descriptor);",
        "Get()(Books.prototype, 'find', descriptor);",
        "Object.defineProperty(Books.prototype, 'find', descriptor);",
        "Controller('books')(Books);",
        'class AppModule {}',
        'Module({ imports: [ResultModule.forRoot()], controllers: [Books], providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }] })(AppModule);',
        '(async () => {',
        '  const app = await NestFactory.create(AppModule, { logger: false });',
        "  await app.listen(0, '127.0.0.1');",
        '  const response = await fetch(`${await app.getUrl()}/books`);',
        "  console.log([response.status, response.headers.get('content-type').split(';')[0]].join(','));",
        '  await app.close();',
        '})();',
      ].join('\n'),
    ]);
    expect(output).toBe(`404,${problemDetailsMediaType('express')}`);
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

  it.each(['nest-result', 'nest-result/swagger', 'nest-result/transactional', 'nest-result/unit-of-work'])(
    'exposes the same names for %s through import and require',
    (entry) => {
      const output = run([
        '--input-type=module',
        '-e',
        `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); console.log(JSON.stringify([Object.keys(await import('${entry}')).sort(), Object.keys(require('${entry}')).sort()]))`,
      ]);
      const [imported, required] = JSON.parse(output);
      expect(imported).toEqual(required);
    },
  );

  it('loads nest-result/unit-of-work through require without require(esm)', () => {
    const output = run([
      '--no-experimental-require-module',
      '-e',
      "console.log(typeof require('nest-result/unit-of-work').withResultUnitOfWork)",
    ]);
    expect(output).toBe('function');
  });

  it.runIf(installedNestMajor === 11).each([
    ['nest-result', 'MapErrors'],
    ['nest-result/swagger', 'MapErrors'],
  ])('loads %s through require without require(esm)', (entry, name) => {
    const output = run(['--no-experimental-require-module', '-e', `console.log(typeof require('${entry}').${name})`]);
    expect(output).toBe('function');
  });
});

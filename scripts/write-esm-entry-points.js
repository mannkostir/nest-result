import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const wrappedEntryPoints = ['index', 'swagger', 'unit-of-work'];
const compiledEsmEntryPoint = 'transactional.js';
const localImport = /(?:from|import) "\.\/([^"]+\.js)"/g;
const commonJsExport = /(?<![\w$.])exports\.([A-Za-z_$][\w$]*) = /g;
const isCompiledEsm = (file) => file.endsWith('.js') || file.endsWith('.js.map');

function importedClosure(file, collected = new Set()) {
  if (collected.has(file)) return collected;
  const withFile = new Set([...collected, file]);
  const source = readFileSync(join(dist, file), 'utf8');
  return [...source.matchAll(localImport)]
    .map((match) => match[1])
    .reduce((closure, dependency) => importedClosure(dependency, closure), withFile);
}

function exportedNames(commonJsFile) {
  const source = readFileSync(join(dist, commonJsFile), 'utf8');
  return [...new Set([...source.matchAll(commonJsExport)].map((match) => match[1]))];
}

function esmWrapper(entryPoint) {
  const names = exportedNames(`${entryPoint}.cjs`);
  if (names.length === 0) throw new Error(`No exports found in dist/${entryPoint}.cjs`);
  return `export { ${names.join(', ')} } from './${entryPoint}.cjs';\n`;
}

const kept = new Set(
  [...importedClosure(compiledEsmEntryPoint)].flatMap((file) => [file, `${file}.map`]),
);

readdirSync(dist)
  .filter(isCompiledEsm)
  .filter((file) => !kept.has(file))
  .forEach((file) => rmSync(join(dist, file)));

wrappedEntryPoints.forEach((entryPoint) =>
  writeFileSync(join(dist, `${entryPoint}.js`), esmWrapper(entryPoint)),
);

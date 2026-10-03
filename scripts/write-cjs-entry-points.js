import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const wrappedEntryPoints = ['index', 'swagger', 'unit-of-work'];
const compiledCommonJsEntryPoint = 'transactional.cjs';
const localRequire = /require\('\.\/([^']+\.cjs)'\)/g;
const isCompiledCommonJs = (file) => file.endsWith('.cjs') || file.endsWith('.cjs.map');

function requiredClosure(file, collected = new Set()) {
  if (collected.has(file)) return collected;
  const withFile = new Set([...collected, file]);
  const source = readFileSync(join(dist, file), 'utf8');
  return [...source.matchAll(localRequire)]
    .map((match) => match[1])
    .reduce((closure, dependency) => requiredClosure(dependency, closure), withFile);
}

const kept = new Set(
  [...requiredClosure(compiledCommonJsEntryPoint)].flatMap((file) => [file, `${file}.map`]),
);

readdirSync(dist)
  .filter(isCompiledCommonJs)
  .filter((file) => !kept.has(file))
  .forEach((file) => rmSync(join(dist, file)));

wrappedEntryPoints.forEach((entryPoint) =>
  writeFileSync(join(dist, `${entryPoint}.cjs`), `module.exports = require('./${entryPoint}.js');\n`),
);

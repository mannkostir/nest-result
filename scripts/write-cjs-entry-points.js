import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const entryPoints = ['index', 'swagger', 'transactional'];
const isCompiledCommonJs = (file) => file.endsWith('.cjs') || file.endsWith('.cjs.map');

readdirSync(dist)
  .filter(isCompiledCommonJs)
  .forEach((file) => rmSync(join(dist, file)));

entryPoints.forEach((entryPoint) =>
  writeFileSync(join(dist, `${entryPoint}.cjs`), `module.exports = require('./${entryPoint}.js');\n`),
);

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const tsc = process.env['TSC_BIN'] ?? resolve('node_modules', '.bin', 'tsc');
const project = resolve('test', 'diagnostics', 'tsconfig.json');

export function compileFixtures(): ReadonlyMap<string, string> {
  const { stdout } = spawnSync(tsc, ['-p', project, '--pretty', 'false'], { encoding: 'utf8' });
  return groupByFixture(stdout);
}

function groupByFixture(output: string): ReadonlyMap<string, string> {
  const blocks = output.split(/\n(?=\S)/).filter((block) => block.trim().length > 0);
  return blocks.reduce((groups, block) => {
    const fixture = /fixtures\/([\w-]+)\.ts\(/.exec(block)?.[1] ?? 'unknown';
    return new Map(groups).set(fixture, `${groups.get(fixture) ?? ''}${block}\n`);
  }, new Map<string, string>());
}

import { readFileSync } from 'node:fs';
import type { Platform } from './create-app.js';

export const installedNestMajor = Number(
  JSON.parse(readFileSync(new URL('../../node_modules/@nestjs/common/package.json', import.meta.url), 'utf8'))
    .version.split('.')[0],
);

export function problemDetailsMediaType(platform: Platform): string {
  return platform === 'express' && installedNestMajor === 11 ? 'application/json' : 'application/problem+json';
}

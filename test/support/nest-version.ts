import { readFileSync } from 'node:fs';
import type { Platform } from './create-app.js';

type Version = readonly [major: number, minor: number, patch: number];

function installedVersion(name: string): Version {
  const manifest: { readonly version: string } = JSON.parse(
    readFileSync(new URL(`../../node_modules/${name}/package.json`, import.meta.url), 'utf8'),
  );
  const [major = 0, minor = 0, patch = 0] = manifest.version.split('.').map((part) => Number.parseInt(part, 10));
  return [major, minor, patch];
}

function isAtLeast([major, minor, patch]: Version, [minMajor, minMinor, minPatch]: Version): boolean {
  if (major !== minMajor) return major > minMajor;
  if (minor !== minMinor) return minor > minMinor;
  return patch >= minPatch;
}

export const installedNestMajor = installedVersion('@nestjs/common')[0];

const expressAdapterVersion = installedVersion('@nestjs/platform-express');

const expressResetsProblemType = expressAdapterVersion[0] === 11 && isAtLeast(expressAdapterVersion, [11, 2, 8]);

export function problemDetailsMediaType(platform: Platform): string {
  return platform === 'express' && expressResetsProblemType ? 'application/json' : 'application/problem+json';
}

import { describe, expect, it } from 'vitest';
import { compileFixtures } from './compile-fixtures.js';

describe('compiler diagnostics text', () => {
  it('matches the recorded diagnostics for every fixture', () => {
    const ordered = [...compileFixtures()].sort(([left], [right]) => left.localeCompare(right));
    expect(ordered).toMatchSnapshot();
  });
});

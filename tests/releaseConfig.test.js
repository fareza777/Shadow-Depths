import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { validateAdIds } from '../src/monetization/adConfig.js';

describe('release ID gate', () => {
  it('requires all five public AdMob identifiers', () => {
    const result = validateAdIds({ release: true });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'AdMob App ID is missing or malformed',
      'AdMob publisher ID is missing or malformed'
    ]));
  });

  it('ships a preparation script with separate debug and release paths', () => {
    const scriptPath = new URL('../scripts/prepare-admob-release.mjs', import.meta.url);
    expect(existsSync(scriptPath)).toBe(true);
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain("--release");
    expect(source).toContain("--debug");
    expect(source).toContain('app-ads.txt');
    expect(source).toContain('Google sample ad IDs are debug-only');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TEST_AD_UNITS, TEST_APP_ID } from '../src/monetization/adConfig.js';

describe('Android release checklist', () => {
  it('keeps version, native AdMob wiring, and Play declaration aligned', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
    const gradle = readFileSync(new URL('../android/app/capacitor.build.gradle', import.meta.url), 'utf8');
    const listing = readFileSync(new URL('../docs/PLAYSTORE.md', import.meta.url), 'utf8');

    const packageLock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
    expect(packageJson.version).toBe('0.2.16');
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[''].version).toBe(packageJson.version);
    expect(manifest).toContain('android:value="@string/admob_app_id"');
    expect(manifest).toContain('com.google.android.gms.permission.AD_ID');
    expect(gradle).toContain("project(':capacitor-community-admob')");
    expect(listing).toMatch(/Contains ads:\*\*\s*\*\*Yes\*\*/i);
  });

  it('keeps test installs separate and all test ad IDs on public sample units', () => {
    const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
    const resources = readFileSync(new URL('../android/app/src/debug/res/values/strings.xml', import.meta.url), 'utf8');
    const script = readFileSync(new URL('../scripts/build-test-apk.ps1', import.meta.url), 'utf8');
    expect(gradle).toContain('applicationId "com.shadowdepths.game"');
    expect(gradle).toContain('applicationIdSuffix ".test"');
    expect(gradle).toContain('versionNameSuffix "-audit-test"');
    expect(resources).toContain('Shadow Depths Test');
    expect(resources).toContain(TEST_APP_ID);
    for (const unit of Object.values(TEST_AD_UNITS)) expect(script).toContain(unit);
    expect(script).toContain('assembleDebug');
    expect(script).not.toContain('bundleRelease');
    expect(script).not.toContain('prepare-admob-release');
  });
});

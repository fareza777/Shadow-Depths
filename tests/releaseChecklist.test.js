import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Android release checklist', () => {
  it('keeps version, native AdMob wiring, and Play declaration aligned', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
    const gradle = readFileSync(new URL('../android/app/capacitor.build.gradle', import.meta.url), 'utf8');
    const listing = readFileSync(new URL('../docs/PLAYSTORE.md', import.meta.url), 'utf8');

    expect(packageJson.version).toBe('0.2.14');
    expect(manifest).toContain('android:value="@string/admob_app_id"');
    expect(manifest).toContain('com.google.android.gms.permission.AD_ID');
    expect(gradle).toContain("project(':capacitor-community-admob')");
    expect(listing).toMatch(/Contains ads:\*\*\s*\*\*Yes\*\*/i);
  });
});

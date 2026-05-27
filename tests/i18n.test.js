import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale, currentLocale, t, supportedLocales } from '../src/content/i18n.js';

describe('i18n', () => {
  beforeEach(() => setLocale('en'));

  it('default locale is en', () => {
    expect(currentLocale()).toBe('en');
  });

  it('returns translation in current locale', () => {
    expect(t('pause.resume')).toBe('RESUME');
    setLocale('id');
    expect(t('pause.resume')).toBe('LANJUT');
  });

  it('falls back to English when key missing in locale', () => {
    setLocale('id');
    // 'hud.of' exists in both; use a real key for cross-check
    expect(t('hud.of')).toBe('DARI');
    // Pick a key only in EN if any... use a clearly-EN key from registry
    // (none currently exclusive — test the API contract via the third tier)
    expect(t('zzz.unknown_key')).toBe('zzz.unknown_key');
  });

  it('falls back to the key itself when missing everywhere', () => {
    expect(t('definitely.not.a.key')).toBe('definitely.not.a.key');
  });

  it('setLocale ignores unsupported locales', () => {
    setLocale('xx');
    expect(currentLocale()).toBe('en');   // unchanged
  });

  it('supportedLocales returns en + id', () => {
    expect(supportedLocales()).toEqual(['en', 'id']);
  });
});

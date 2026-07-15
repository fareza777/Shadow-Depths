import { describe, expect, it, vi } from 'vitest';
import { PLAY_STORE_URL, openPlayStore } from '../src/platform/playStore.js';

describe('Play Store launcher', () => {
  it('targets the published Shadow Depths package', () => {
    expect(PLAY_STORE_URL).toBe(
      'https://play.google.com/store/apps/details?id=com.shadowdepths.game'
    );
  });

  it('uses the Capacitor browser on native platforms', async () => {
    const browser = { open: vi.fn().mockResolvedValue(undefined) };

    await expect(openPlayStore({ platform: 'android', browser })).resolves.toBe('native');
    expect(browser.open).toHaveBeenCalledWith({ url: PLAY_STORE_URL });
  });

  it('opens a safe new tab on the web', async () => {
    const windowRef = { open: vi.fn(() => ({})) };

    await expect(openPlayStore({ platform: 'web', windowRef })).resolves.toBe('web');
    expect(windowRef.open).toHaveBeenCalledWith(
      PLAY_STORE_URL,
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('reports when the web browser blocks the rating page', async () => {
    const windowRef = { open: () => null };

    await expect(openPlayStore({ platform: 'web', windowRef }))
      .rejects.toThrow('Unable to open Google Play');
  });
});

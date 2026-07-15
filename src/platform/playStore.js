import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.shadowdepths.game';

/** Open the public store listing through the platform-appropriate surface. */
export async function openPlayStore({
  platform = Capacitor.getPlatform(),
  browser = Browser,
  windowRef = globalThis.window
} = {}) {
  if (platform === 'android' || platform === 'ios') {
    await browser.open({ url: PLAY_STORE_URL });
    return 'native';
  }

  const opened = windowRef?.open?.(
    PLAY_STORE_URL,
    '_blank',
    'noopener,noreferrer'
  );
  if (!opened) throw new Error('Unable to open Google Play');
  return 'web';
}

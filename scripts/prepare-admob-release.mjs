import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  TEST_APP_ID,
  validateAdIds
} from '../src/monetization/adConfig.js';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const ADMOB_RESOURCE = resolve(ROOT, 'android/app/src/main/res/values/admob.xml');
const APP_ADS_TXT = resolve(ROOT, 'public/app-ads.txt');

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function writeAdmobResource(appId) {
  mkdirSync(resolve(ROOT, 'android/app/src/main/res/values'), { recursive: true });
  writeFileSync(ADMOB_RESOURCE, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="admob_app_id" translatable="false">${xmlEscape(appId)}</string>\n</resources>\n`, 'utf8');
}

function envIds() {
  return {
    appId: process.env.ADMOB_APP_ID || '',
    banner: process.env.ADMOB_BANNER_ID || '',
    interstitial: process.env.ADMOB_INTERSTITIAL_ID || '',
    rewarded: process.env.ADMOB_REWARDED_ID || '',
    publisherId: process.env.ADMOB_PUBLISHER_ID || ''
  };
}

function main() {
  const release = process.argv.includes('--release');
  const debug = process.argv.includes('--debug');
  if (release === debug) {
    console.error('Usage: node scripts/prepare-admob-release.mjs --release|--debug');
    return 1;
  }

  if (debug) {
    writeAdmobResource(TEST_APP_ID);
    console.log('Prepared AdMob debug resources with Google sample IDs.');
    return 0;
  }

  const ids = envIds();
  const validation = validateAdIds({ ...ids, release: true });
  if (!validation.ok) {
    console.error('AdMob release preparation blocked:');
    for (const error of validation.errors) console.error(` - ${error}`);
    // Google sample ad IDs are debug-only; no production file is changed here.
    return 1;
  }

  writeAdmobResource(ids.appId);
  mkdirSync(resolve(ROOT, 'public'), { recursive: true });
  writeFileSync(APP_ADS_TXT,
    `google.com, ${ids.publisherId}, DIRECT, f08c47fec0942fa0\n`, 'utf8');
  console.log('Prepared AdMob release resources and app-ads.txt.');
  return 0;
}

process.exitCode = main();

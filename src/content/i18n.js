/**
 * i18n — minimal string registry for UI labels.
 *
 * Pattern: keys are dot-notation ('hud.floor', 'pause.resume'), values
 * are short translation tables keyed by locale. Default locale is 'en'.
 * Pass-through behaviour: when a key isn't in the registered locale, it
 * falls back to English; when it isn't in English either, the key
 * itself is returned (handy during development).
 *
 * Setting the locale: meta.settings.locale = 'id'. Reload required.
 *
 * NOTE: this scaffolding is intentionally lightweight. Production-grade
 * features (interpolation, plural forms) are TODO — the API t(key) is
 * future-compatible because it accepts a second 'params' argument.
 */

const REGISTRY = new Map();
let CURRENT_LOCALE = 'en';

const SUPPORTED = ['en', 'id'];

const EN = {
  // HUD
  'hud.floor':         'FLOOR',
  'hud.of':            'OF',
  'hud.daily':         '☼ DAILY',
  'hud.rest':          '✜ REST',
  'hud.vault':         '◈ VAULT',
  // Pause
  'pause.title':       'PAUSED',
  'pause.subtitle':    'the descent can wait',
  'pause.resume':      'RESUME',
  'pause.forge':       'FORGE',
  'pause.quit':        'QUIT TO MENU',
  // Title menu
  'title.continue':    'CONTINUE',
  'title.newrun':      'NEW DESCENT',
  'title.daily':       'DAILY SEED',
  'title.shop':        'EMPORIUM',
  'title.codex':       'CODEX',
  'title.meta':        'META-PROGRESS',
  'title.settings':    'SETTINGS',
  // Crafting
  'craft.title':       'THE FORGE',
  'craft.subtitle':    'shape what the depths gave you',
  'craft.btn':         'CRAFT',
  'craft.close':       'CLOSE',
  // Identification
  'id.curious_phial':  'Curious Phial',
  'id.unknown_scroll': 'Sealed Scroll',
  'id.unknown_ring':   'Tarnished Ring',
  // Misc
  'common.empty':      '— EMPTY —',
  'common.unequip':    'UNEQUIP'
};

const ID = {
  'hud.floor':         'LANTAI',
  'hud.of':            'DARI',
  'hud.daily':         '☼ HARIAN',
  'hud.rest':          '✜ ISTIRAHAT',
  'hud.vault':         '◈ RUANG HARTA',
  'pause.title':       'JEDA',
  'pause.subtitle':    'gerbang menanti',
  'pause.resume':      'LANJUT',
  'pause.forge':       'TEMPA',
  'pause.quit':        'KELUAR KE MENU',
  'title.continue':    'LANJUTKAN',
  'title.newrun':      'PERTUALANGAN BARU',
  'title.daily':       'TANTANGAN HARIAN',
  'title.shop':        'EMPORIUM',
  'title.codex':       'KODEKS',
  'title.meta':        'KEMAJUAN',
  'title.settings':    'PENGATURAN',
  'craft.title':       'TEMPA',
  'craft.subtitle':    'bentuk apa yang kau dapat',
  'craft.btn':         'TEMPA',
  'craft.close':       'TUTUP',
  'id.curious_phial':  'Botol Aneh',
  'id.unknown_scroll': 'Gulungan Tersegel',
  'id.unknown_ring':   'Cincin Pudar',
  'common.empty':      '— KOSONG —',
  'common.unequip':    'LEPAS'
};

REGISTRY.set('en', EN);
REGISTRY.set('id', ID);

export function setLocale(locale) {
  if (SUPPORTED.includes(locale)) CURRENT_LOCALE = locale;
}

export function currentLocale() { return CURRENT_LOCALE; }

/** Translate a key. Falls back to English, then to the key itself. */
export function t(key) {
  const localTable = REGISTRY.get(CURRENT_LOCALE);
  if (localTable && key in localTable) return localTable[key];
  const en = REGISTRY.get('en');
  if (en && key in en) return en[key];
  return key;
}

export function supportedLocales() {
  return SUPPORTED.slice();
}

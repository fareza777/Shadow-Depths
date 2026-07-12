/**
 * i18n — minimal string registry for UI labels.
 *
 * Pattern: keys are dot-notation ('hud.floor', 'pause.resume'), values
 * are short translation tables keyed by locale. Default locale is 'en'.
 * Pass-through behaviour: when a key isn't in the registered locale, it
 * falls back to English; when it isn't in English either, the key
 * itself is returned (handy during development).
 *
 * Setting the locale: meta.settings.locale = 'en' | 'id' (TitleScreen
 * Settings has a LANGUAGE toggle). Reload recommended after change.
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
  'hud.forge':         '⚒ FORGE',
  'hud.vault':         '◈ VAULT',
  // Pause
  'pause.title':       'PAUSED',
  'pause.subtitle':    'the descent can wait',
  'pause.resume':      'RESUME',
  'pause.forge':       'FIND SMITH',
  'pause.quit':        'QUIT TO MENU',
  // Title menu
  'title.continue':    'CONTINUE',
  'title.newrun':      'NEW DESCENT',
  'title.tutorial':    'TUTORIAL',
  'title.daily':       'DAILY SEED',
  'title.unlock':      'FULL DESCENT',
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
  'common.unequip':    'UNEQUIP',
  // Game over
  'gameover.title':           'YOU DIED',
  'gameover.killed_by':       'Killed by',
  'gameover.killed_dark':     'Killed by the dark.',
  'gameover.floor':           'Floor reached',
  'gameover.enemies':         'Enemies defeated',
  'gameover.items':           'Items used',
  'gameover.xp':              'XP gained',
  'gameover.gold':            'Gold collected',
  'gameover.turns':           'Turns played',
  'gameover.score':           'SCORE',
  'gameover.highscore':       '★ NEW HIGH SCORE ★',
  'gameover.coins':           'coins (spend in shop)',
  'gameover.unlocked':        'Unlocked',
  'gameover.restart':         'RESTART',
  'gameover.title_btn':       'TITLE',
  'gameover.build':           'Build',
  'gameover.gear':            'Gear',
  'gameover.hint':            'Hint',
  'gameover.hint_boss':       'Learn the boss telegraph — wait the wind-up, then strike.',
  'gameover.hint_armor':      'Prioritize armor drops before pushing deeper.',
  'gameover.hint_consumables':'Use potions and scrolls — hoarding them helps nobody.',
  'gameover.hint_skills':     'Level up and pick skills; raw stats win early fights.',
  'gameover.hint_early':      'Clear rooms carefully; stair greed ends runs fast.',
  'gameover.hint_torch':      'Stay near light and retreat when surrounded.',
  // Paywall
  'paywall.title':            'FULL DESCENT',
  'paywall.subtitle':         'one purchase · unlock forever',
  'paywall.no_ads':           'NO ADS  ·  NO SUBSCRIPTION',
  'paywall.unlock':           'UNLOCK',
  'paywall.restore':          'RESTORE PURCHASES',
  'paywall.not_now':          'NOT NOW',
  'paywall.wait':             'PLEASE WAIT…',
  // Tutorial
  'tutorial.skip':            'SKIP',
  'tutorial.continue':        'Tap or move to continue',
  'tutorial.begin':           'Tap or move to begin',
  'tutorial.eyebrow':         'FIRST RUN',
  'tutorial.eyebrow_keeper':  'GUIDED TUTORIAL',
  // Settings extras
  'settings.language':        'LANGUAGE',
  'settings.analytics':       'ANALYTICS',
  'settings.analytics_on':    'SHARE ANONYMOUS EVENTS · ON',
  'settings.analytics_off':   'SHARE ANONYMOUS EVENTS · OFF'
};

const ID = {
  'hud.floor':         'LANTAI',
  'hud.of':            'DARI',
  'hud.daily':         '☼ HARIAN',
  'hud.rest':          '✜ ISTIRAHAT',
  'hud.forge':         '⚒ TEMPA',
  'hud.vault':         '◈ RUANG HARTA',
  'pause.title':       'JEDA',
  'pause.subtitle':    'gerbang menanti',
  'pause.resume':      'LANJUT',
  'pause.forge':       'CARI PANDAI',
  'pause.quit':        'KELUAR KE MENU',
  'title.continue':    'LANJUTKAN',
  'title.newrun':      'PERTUALANGAN BARU',
  'title.tutorial':    'TUTORIAL',
  'title.daily':       'TANTANGAN HARIAN',
  'title.unlock':      'FULL DESCENT',
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
  'common.unequip':    'LEPAS',
  'gameover.title':           'KAU MATI',
  'gameover.killed_by':       'Dibunuh oleh',
  'gameover.killed_dark':     'Dibunuh oleh kegelapan.',
  'gameover.floor':           'Lantai dicapai',
  'gameover.enemies':         'Musuh dikalahkan',
  'gameover.items':           'Item dipakai',
  'gameover.xp':              'XP didapat',
  'gameover.gold':            'Emas dikumpulkan',
  'gameover.turns':           'Giliran dimainkan',
  'gameover.score':           'SKOR',
  'gameover.highscore':       '★ REKOR BARU ★',
  'gameover.coins':           'koin (belanja di toko)',
  'gameover.unlocked':        'Terbuka',
  'gameover.restart':         'ULANGI',
  'gameover.title_btn':       'MENU',
  'gameover.build':           'Build',
  'gameover.gear':            'Peralatan',
  'gameover.hint':            'Saran',
  'gameover.hint_boss':       'Pelajari telegraph boss — tunggu wind-up, lalu serang.',
  'gameover.hint_armor':      'Prioritaskan armor sebelum turun lebih dalam.',
  'gameover.hint_consumables':'Pakai potion dan scroll — menimbun tidak menolong.',
  'gameover.hint_skills':     'Naik level dan ambil skill; stats mentah menang di awal.',
  'gameover.hint_early':      'Bersihkan ruangan pelan-pelan; buru-buru ke tangga sering mati.',
  'gameover.hint_torch':      'Dekati cahaya dan mundur saat dikepung.',
  'paywall.title':            'FULL DESCENT',
  'paywall.subtitle':         'sekali beli · terbuka selamanya',
  'paywall.no_ads':           'TANPA IKLAN  ·  TANPA LANGGANAN',
  'paywall.unlock':           'BUKA',
  'paywall.restore':          'PULIHKAN PEMBELIAN',
  'paywall.not_now':          'NANTI SAJA',
  'paywall.wait':             'MOHON TUNGGU…',
  'tutorial.skip':            'LEWATI',
  'tutorial.continue':        'Ketuk atau gerak untuk lanjut',
  'tutorial.begin':           'Ketuk atau gerak untuk mulai',
  'tutorial.eyebrow':         'PERTAMA KALI',
  'tutorial.eyebrow_keeper':  'TUTORIAL TERBIMBING',
  'settings.language':        'BAHASA',
  'settings.analytics':       'ANALITIK',
  'settings.analytics_on':    'BAGIKAN EVENT ANONIM · ON',
  'settings.analytics_off':   'BAGIKAN EVENT ANONIM · OFF'
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

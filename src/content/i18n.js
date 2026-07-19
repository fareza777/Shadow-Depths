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
  'title.about':       'ABOUT',
  'about.subtitle':    'forged for those who descend',
  'about.description': 'A turn-based roguelike forged in shadow, where every choice echoes deeper.',
  'about.turn_based':  'TURN-BASED',
  'about.offline':     'OFFLINE',
  'about.no_ads':      'NO ADS',
  'about.rate_prompt': 'Enjoying the descent? Leave your mark.',
  'about.rate':        'RATE ON GOOGLE PLAY',
  'about.rate_failed': 'Google Play could not be opened.',
  'about.version':     'VERSION',
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
  'gameover.teach_paywall':   'Floors 11–100 await with Full Descent — one unlock, forever.',
  'gameover.teach_clear':     'Clear more rooms before the stairs; XP and gear compound.',
  'gameover.teach_skills':    'Take skills early — synergies carry deep floors.',
  'gameover.teach_default':   'Watch enemy intent icons — !! means wind-up, then punish.',
  'gameover.teaser':          'Beyond the free depths',
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
  'settings.analytics_off':   'SHARE ANONYMOUS EVENTS · OFF',
  'settings.reduce_motion_on':'REDUCE MOTION · ON',
  'settings.reduce_motion_off':'REDUCE MOTION · OFF',
  'settings.contrast_on':     'HIGH-CONTRAST THREATS · ON',
  'settings.contrast_off':    'HIGH-CONTRAST THREATS · OFF',
  'settings.text_large':      'TEXT SIZE · LARGE',
  'settings.text_normal':     'TEXT SIZE · NORMAL',
  'victory.title':            'YOU ESCAPED',
  'victory.subtitle':         'the Depths… for now.',
  'victory.floors':           'Floors cleared',
  'victory.enemies':          'Enemies defeated',
  'victory.perfect':          'Perfect floors',
  'victory.turns':            'Turns played',
  'victory.gold':             'Gold',
  'victory.score':            'SCORE',
  'victory.foreshadow':       'Deeper gates still wait beyond this seal.',
  'victory.newrun':           'NEW RUN',
  'victory.title_btn':        'TITLE',
  'tutorial.step_move_t':     'MOVE',
  'tutorial.step_move_b':     'Use the D-pad (bottom-left) or tap a floor tile to walk one step per turn.',
  'tutorial.step_attack_t':   'ATTACK',
  'tutorial.step_attack_b':   'Walk into an enemy, tap them when adjacent, or tap your hero while a foe is next to you.',
  'tutorial.step_loot_t':     'LOOT & DESCEND',
  'tutorial.step_loot_b':     'Use the QUICK row: PICK, BAG, HERO. DOWN (right) uses stairs to the next floor.',
  'tutorial.step_forge_t':    'FORGE & DEPTH',
  'tutorial.step_forge_b':    'Materials go to a pouch. Open BAG → POUCH to review them. On forge sanctuary floors, PICK calls the smith.',
  'tutorial.keeper_welcome_t':'THE KEEPER',
  'tutorial.keeper_welcome_b':'Welcome to a two-floor lesson. Move one tile at a time, keep the lantern circle around you, and use PICK beside glowing objects.',
  'tutorial.keeper_room_t':   'READ THE ROOM',
  'tutorial.keeper_room_b':   'Gold glows mark people or pedestals. Blue cracks, bones, banners, and torches are landmarks that help you remember each room.',
  'tutorial.keeper_fight_t':  'FIRST FIGHT',
  'tutorial.keeper_fight_b':  'Step next to an enemy and tap it, or walk into it, to attack. Back away when low HP and use your quick row for consumables.',
  'tutorial.keeper_loot_t':   'LOOT & EQUIP',
  'tutorial.keeper_loot_b':   'Stand on loot and press PICK. Open BAG to equip better gear; your hero silhouette changes as armor and weapons improve.',
  'tutorial.keeper_down_t':   'DESCEND',
  'tutorial.keeper_down_b':   'Find the stair sigil, stand on it, then press DOWN. The second tutorial floor ends the lesson and returns you ready for a real descent.',
  'char.choose':              'CHOOSE YOUR VIGIL',
  'char.choose_btn':          'CHOOSE',
  'char.prev':                'PREV',
  'char.next':                'NEXT'
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
  'title.about':       'TENTANG',
  'about.subtitle':    'ditempa bagi mereka yang berani turun',
  'about.description': 'Roguelike berbasis giliran yang ditempa dalam bayang-bayang; setiap pilihan bergema lebih dalam.',
  'about.turn_based':  'BERGILIRAN',
  'about.offline':     'OFFLINE',
  'about.no_ads':      'TANPA IKLAN',
  'about.rate_prompt': 'Menikmati petualangannya? Tinggalkan jejakmu.',
  'about.rate':        'BERI RATING DI GOOGLE PLAY',
  'about.rate_failed': 'Google Play tidak dapat dibuka.',
  'about.version':     'VERSI',
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
  'gameover.teach_paywall':   'Lantai 11–100 menunggu dengan Full Descent — sekali beli, selamanya.',
  'gameover.teach_clear':     'Bersihkan lebih banyak ruangan sebelum tangga; XP dan gear menumpuk.',
  'gameover.teach_skills':    'Ambil skill lebih awal — sinergi membawa ke lantai dalam.',
  'gameover.teach_default':   'Pantau ikon intent musuh — !! berarti wind-up, lalu serang.',
  'gameover.teaser':          'Di balik kedalaman gratis',
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
  'settings.analytics_off':   'BAGIKAN EVENT ANONIM · OFF',
  'settings.reduce_motion_on':'KURANGI GERAK · ON',
  'settings.reduce_motion_off':'KURANGI GERAK · OFF',
  'settings.contrast_on':     'ANCAMAN KONTRAS TINGGI · ON',
  'settings.contrast_off':    'ANCAMAN KONTRAS TINGGI · OFF',
  'settings.text_large':      'UKURAN TEKS · BESAR',
  'settings.text_normal':     'UKURAN TEKS · NORMAL',
  'victory.title':            'KAU LOLAS',
  'victory.subtitle':         'Kedalaman… untuk sekarang.',
  'victory.floors':           'Lantai dibersihkan',
  'victory.enemies':          'Musuh dikalahkan',
  'victory.perfect':          'Lantai sempurna',
  'victory.turns':            'Giliran dimainkan',
  'victory.gold':             'Emas',
  'victory.score':            'SKOR',
  'victory.foreshadow':       'Gerbang lebih dalam masih menunggu di balik segel ini.',
  'victory.newrun':           'MAIN LAGI',
  'victory.title_btn':        'MENU',
  'tutorial.step_move_t':     'GERAK',
  'tutorial.step_move_b':     'Pakai D-pad (kiri bawah) atau ketuk lantai untuk berjalan satu langkah per giliran.',
  'tutorial.step_attack_t':   'SERANG',
  'tutorial.step_attack_b':   'Jalani musuh, ketuk saat bersebelahan, atau ketuk hero saat musuh di sampingmu.',
  'tutorial.step_loot_t':     'LOOT & TURUN',
  'tutorial.step_loot_b':     'Pakai baris QUICK: PICK, BAG, HERO. DOWN (kanan) memakai tangga ke lantai berikutnya.',
  'tutorial.step_forge_t':    'TEMPA & DALAM',
  'tutorial.step_forge_b':    'Material masuk kantong. Buka BAG → POUCH untuk melihat. Di lantai forge, PICK memanggil pandai.',
  'tutorial.keeper_welcome_t':'PENJAGA',
  'tutorial.keeper_welcome_b':'Selamat datang di pelajaran dua lantai. Bergerak satu kotak, jaga lingkaran lentera, dan PICK di objek yang berkilau.',
  'tutorial.keeper_room_t':   'BACA RUANGAN',
  'tutorial.keeper_room_b':   'Kilau emas menandai orang atau pedestal. Retakan biru, tulang, spanduk, dan obor membantu mengingat tiap ruangan.',
  'tutorial.keeper_fight_t':  'PERTARUNGAN PERTAMA',
  'tutorial.keeper_fight_b':  'Berdiri di samping musuh lalu ketuk, atau berjalan ke arahnya untuk menyerang. Mundur saat HP rendah dan pakai quick row.',
  'tutorial.keeper_loot_t':   'LOOT & EQUIP',
  'tutorial.keeper_loot_b':   'Berdiri di atas loot lalu PICK. Buka BAG untuk equip; siluet hero berubah saat armor dan senjata membaik.',
  'tutorial.keeper_down_t':   'TURUN',
  'tutorial.keeper_down_b':   'Cari tangga, berdiri di atasnya, lalu tekan DOWN. Lantai tutorial kedua mengakhiri pelajaran.',
  'char.choose':              'PILIH VIGIL-MU',
  'char.choose_btn':          'PILIH',
  'char.prev':                'SEBELUM',
  'char.next':                'LANJUT'
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

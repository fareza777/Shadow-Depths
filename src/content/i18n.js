/**
 * i18n — minimal string registry for UI labels.
 *
 * Pattern: keys are dot-notation ('hud.floor', 'pause.resume'), values
 * are short translation tables keyed by locale. Default locale is 'en'.
 * Pass-through behaviour: when a key isn't in the registered locale, it
 * falls back to English; when it isn't in English either, the key
 * itself is returned (handy during development).
 *
 * Locale is fixed to English ('en') — the game ships English-only.
 * setLocale() is kept as a no-op guard for legacy saved settings.
 *
 * NOTE: this scaffolding is intentionally lightweight. Production-grade
 * features (interpolation, plural forms) are TODO — the API t(key) is
 * future-compatible because it accepts a second 'params' argument.
 */

const REGISTRY = new Map();
let CURRENT_LOCALE = 'en';

const SUPPORTED = ['en'];

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
  'title.unlock':      'REMOVE ADS',
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
  'gameover.teach_paywall':   'The whole 100-floor descent is free. Remove ads once, forever.',
  'gameover.teach_clear':     'Clear more rooms before the stairs; XP and gear compound.',
  'gameover.teach_skills':    'Take skills early — synergies carry deep floors.',
  'gameover.teach_default':   'Watch enemy intent icons — !! means wind-up, then punish.',
  'gameover.teaser':          'Beyond the free depths',
  'gameover.unlock_cta':      'Enjoying the descent? Remove ads — one purchase, forever.',
  // Paywall
  'paywall.title':            'REMOVE ADS',
  'paywall.subtitle':         'one purchase · ad-free forever',
  'paywall.no_ads':           'NO SUBSCRIPTION  ·  NO PAY-TO-WIN',
  'paywall.unlock':           'REMOVE ADS',
  'paywall.restore':          'RESTORE PURCHASES',
  'paywall.not_now':          'NOT NOW',
  'paywall.wait':             'PLEASE WAIT…',
  'paywall.benefit_floors':   'No ads, ever',
  'paywall.benefit_biomes':   'No interruptions mid-run',
  'paywall.benefit_forever':  'Forever — one purchase',
  'paywall.benefit_noads':    'Supports a solo developer',
  'paywall.cleared_free':     'All 100 floors are free to play.',
  'paywall.beyond':           'Ads keep it that way — remove them if you would rather not see them.',
  'paywall.continue_deep':    'Your descent continues — nothing is locked.',
  'paywall.continue_cap':     'Every floor is open to every player.',
  'paywall.continue_unlock':  'Remove ads for an uninterrupted run.',
  'paywall.flash_opening':    'Opening Play Store…',
  'paywall.flash_unlocked':   'Ads removed — thank you!',
  'paywall.flash_cancelled':  'Purchase cancelled',
  'paywall.flash_dev':        'Ads removed (dev)',
  'paywall.flash_failed':     'Purchase failed — try Restore',
  'paywall.flash_restoring':  'Restoring…',
  'paywall.flash_restored':   'Purchases restored!',
  'paywall.flash_none':       'No purchase found',
  'paywall.flash_restore_fail':'Restore failed',
  // Skills
  'skills.level_up':          'LEVEL UP',
  'skills.choose':            'Choose a boon',
  'skills.choose_n':          'Choose a boon  ({n} remaining)',
  'skills.reroll':            'REROLL',
  'skills.tap_hint':          'Tap a boon',
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

REGISTRY.set('en', EN);

export function setLocale(locale) {
  if (SUPPORTED.includes(locale)) CURRENT_LOCALE = locale;
}

export function currentLocale() { return CURRENT_LOCALE; }

/** Translate a key. Falls back to English, then to the key itself.
 *  Optional `params` replaces `{name}` tokens in the string. */
export function t(key, params) {
  const localTable = REGISTRY.get(CURRENT_LOCALE);
  let s = (localTable && key in localTable) ? localTable[key]
    : (REGISTRY.get('en') && key in REGISTRY.get('en')) ? REGISTRY.get('en')[key]
    : key;
  if (params && typeof s === 'string') {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export function supportedLocales() {
  return SUPPORTED.slice();
}

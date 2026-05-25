/**
 * Engine-level constants. Values here are structural (tile size, layout grid,
 * keybinds, palette). Anything that is *gameplay tuning* lives in
 * `src/config/balance.js` or `data/balance.json` instead — split intentional:
 * structural constants almost never change, balance tuned weekly.
 */

// --- Render / world grid -------------------------------------------------
// World is 40 × 28 tiles. We do NOT render the entire world into one canvas
// — that yielded 9 px tiles on a 360-wide phone in v0.1. Instead the canvas
// is portrait-shaped (mobile-first), tile size is bumped, and the Renderer
// uses a camera that follows the player. The world is bigger than the view.
export const TILE_SIZE = 40;            // px per tile (mobile readability; world scrolls via camera)
export const GRID_WIDTH = 40;           // world width in tiles
export const GRID_HEIGHT = 28;          // world height in tiles

// Orientation is chosen ONCE at module load (synchronous localStorage read)
// so every component imports the matching geometry constants. Changing the
// setting requires a page reload — Settings modal calls location.reload().
//
// ESCAPE HATCH: a `?orientation=portrait` (or `?orientation=landscape`) URL
// query overrides the saved setting AND rewrites the saved value, so a
// player who got stuck in an unusable layout can recover by appending
// the query to the address bar.
function _readOrientation() {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlOrient = params.get('orientation');
    if (urlOrient === 'portrait' || urlOrient === 'landscape') {
      // Persist the override into the meta blob so subsequent reloads
      // without the query string keep the chosen orientation.
      try {
        const raw = localStorage.getItem('shadowdepths_meta');
        const meta = raw ? JSON.parse(raw) : {};
        meta.settings = meta.settings || {};
        meta.settings.orientation = urlOrient;
        localStorage.setItem('shadowdepths_meta', JSON.stringify(meta));
      } catch { /* storage blocked — orientation still applies for this load */ }
      return urlOrient;
    }
    const raw = localStorage.getItem('shadowdepths_meta');
    if (raw) {
      const meta = JSON.parse(raw);
      if (meta?.settings?.orientation === 'landscape') return 'landscape';
    }
  } catch { /* localStorage blocked — fall back */ }
  return 'portrait';
}
export const ORIENTATION_MODE = _readOrientation();
export const IS_LANDSCAPE = ORIENTATION_MODE === 'landscape';

// Canvas dims swap with orientation.
function _portraitCanvasHeight(width) {
  try {
    const vw = window.visualViewport?.width || window.innerWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
    if (vh > vw && vw > 0) {
      return Math.max(960, Math.min(1120, Math.round(width * (vh / vw))));
    }
  } catch { /* non-browser tooling: use design default */ }
  return 1040;
}

export const CANVAS_WIDTH  = IS_LANDSCAPE ? 800 : 480;
export const CANVAS_HEIGHT = IS_LANDSCAPE ? 480 : _portraitCanvasHeight(CANVAS_WIDTH);
export const RENDER_WIDTH  = CANVAS_WIDTH;
export const RENDER_HEIGHT = CANVAS_HEIGHT;

// Layout zones:
//
//   PORTRAIT (default):
//   ┌─────────────────────────┐  ← HUD strip top
//   │       WORLD VIEWPORT    │
//   ├─────────────────────────┤
//   │ DPAD │  MAP  │ ACTIONS  │  ← bottom control band
//   └─────────────────────────┘
//
//   LANDSCAPE:
//   ┌─────────────────────────┐  ← HUD strip top (slimmer)
//   │   │                 │   │
//   │DPA│   WORLD VIEWPORT│ACT│  ← side control strips
//   │ + │                 │ + │
//   │MAP│                 │MSG│
//   └─────────────────────────┘
// Landscape HUD needs the same vertical real-estate as portrait now that
// skill chips landed (chip rows live at y~92 inside the strip). Side bars
// recover that pixel real-estate from the horizontal width budget.
export const HUD_HEIGHT         = IS_LANDSCAPE ? 108 : 112;
export const CONTROL_HEIGHT     = IS_LANDSCAPE ? 0   : 228;
export const SIDE_CONTROL_WIDTH = IS_LANDSCAPE ? 136 : 0;

/** Global UI text scale — bump labels on mobile without retuning every screen. */
export const UI_SCALE = 1.35;
export function uiSize(n) {
  return Math.max(8, Math.round(n * UI_SCALE));
}

export const VIEWPORT_X = SIDE_CONTROL_WIDTH;
export const VIEWPORT_Y = HUD_HEIGHT;
export const VIEWPORT_W = CANVAS_WIDTH - SIDE_CONTROL_WIDTH * 2;
export const VIEWPORT_H = CANVAS_HEIGHT - HUD_HEIGHT - CONTROL_HEIGHT;

// --- Tile types ---------------------------------------------------------
// Numeric enums (faster to compare and store in 2D arrays than strings).
export const TILE = Object.freeze({
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  DOOR: 3,
  STAIRS_DOWN: 4,
  STAIRS_UP: 5
});

// --- Color palette ------------------------------------------------------
// Warm dark-fantasy palette — closer to candlelight than deep void. Tuned
// to match the Shadow Depths mock: charcoal-with-purple backgrounds, aged
// gold accents, cream text, parchment-like highlights.
export const COLOR = Object.freeze({
  bg: '#1a1620',              // primary canvas background (warm dark)
  bgPanel: '#241e2a',          // panel / strip background
  bgPanelAlt: '#1d1824',       // alternating row tint
  bgCard: '#2a232e',           // raised card surface
  bgCardHi: '#352c3a',         // selected card

  void: '#080610',
  wallLit: '#3e3548',
  wallDim: '#1c1822',
  floorLit: '#2e2734',
  floorDim: '#181420',
  stairs: '#d4be7a',
  door: '#7a5436',

  player: '#e8e0d0',
  enemy: '#b85052',
  enemyRanged: '#7a98c0',
  enemyTank: '#9a8060',
  enemyErratic: '#806298',
  enemyPhase: '#683868',

  // Rarity colors — used by inventory cards and tooltips.
  itemCommon: '#c8c4b8',
  itemUncommon: '#6ad07c',
  itemRare: '#7aa6e8',
  itemEpic: '#c884e8',

  // Gold accent — the signature color of the UI.
  gold: '#d4be7a',
  goldHi: '#f0d890',
  goldDim: '#9a8a4a',

  textPrimary: '#e8e0d0',      // cream
  textMuted: '#9a8a78',        // weathered parchment
  textCrit: '#e85a4a',
  textHeal: '#8fd075',
  textXP: '#e0c870',

  hpBar: '#a83838',
  hpBarBg: '#3a1a1a',
  xpBar: '#d4be7a',
  xpBarBg: '#3a2e1a',

  borderSoft: '#3a3340',
  borderAccent: '#d4be7a'
});

// --- Typography ---------------------------------------------------------
// All three families are loaded by index.html via Google Fonts so they're
// already in the document's font cache by the time Canvas2D needs them.
// Use FONT_BODY for atmospheric flavor text, FONT_DISPLAY for headers and
// section titles, FONT_MONO for stats and HUD numbers (which need to align
// in columns and benefit from a true monospace).
export const FONT_DISPLAY = '"Cinzel", "Times New Roman", serif';
export const FONT_BODY    = '"IM Fell English", Georgia, serif';
export const FONT_MONO    = '"Inconsolata", "Courier New", monospace';

// --- Keybinds -----------------------------------------------------------
// Player can re-bind in v0.4. For now hard-codes are accepted because they
// also live in the Controls Help modal — single source of truth.
export const KEYBIND = Object.freeze({
  moveUp:    ['ArrowUp', 'w', 'W', 'k', 'K'],
  moveDown:  ['ArrowDown', 's', 'S', 'j', 'J'],
  moveLeft:  ['ArrowLeft', 'a', 'A', 'h', 'H'],
  moveRight: ['ArrowRight', 'd', 'D', 'l', 'L'],
  wait:      ['.', ' '],
  pickup:    ['g', 'G', 'Enter'],
  descend:   ['>', 'PageDown'],
  inventory: ['i', 'I', 'Tab'],
  minimap:   ['m', 'M'],
  hotkey1:   ['1'],
  hotkey2:   ['2'],
  hotkey3:   ['3'],
  hotkey4:   ['4'],
  hotkey5:   ['5'],
  hotkey6:   ['6'],
  hotkey7:   ['7'],
  hotkey8:   ['8'],
  hotkey9:   ['9'],
  escape:    ['Escape']
});

// --- Animation timings (ms) --------------------------------------------
export const TIMING = Object.freeze({
  moveTween: 80,
  attackLunge: 120,
  hitFlash: 60,
  damageNumberLife: 600,
  deathShrink: 200,
  cameraShakeShort: 5 * 16,
  cameraShakeLong: 15 * 16,
  hitPauseCrit: 50,
  floorFadeOut: 300,
  floorFadeIn: 300,
  floorNameHold: 1000,
  uiPanelSlide: 150
});

// --- Storage ------------------------------------------------------------
export const STORAGE_PREFIX = 'shadowdepths_';
export const SAVE_SCHEMA_VERSION = 1;

// --- Logging tags (use as first arg in console.log/warn) ---------------
export const LOG = Object.freeze({
  CORE: '[Core]',
  COMBAT: '[Combat]',
  DUNGEON: '[Dungeon]',
  ENTITY: '[Entity]',
  ITEM: '[Item]',
  SAVE: '[Save]',
  RENDER: '[Render]',
  AUDIO: '[Audio]',
  UI: '[UI]',
  INPUT: '[Input]'
});

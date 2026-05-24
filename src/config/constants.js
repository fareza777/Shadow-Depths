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
export const TILE_SIZE = 32;            // px per tile (bumped from 24 → 32 for tap targets)
export const GRID_WIDTH = 40;           // world width in tiles
export const GRID_HEIGHT = 28;          // world height in tiles

// Logical canvas — portrait, sized so each tile is a comfortable 32 px on phone.
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 800;

export const RENDER_WIDTH = CANVAS_WIDTH;
export const RENDER_HEIGHT = CANVAS_HEIGHT;

// Three-band layout (v0.2.1, mobile-first):
//   ┌─────────────────────────┐  ← HUD top strip (HP/XP/stats)
//   ├─────────────────────────┤
//   │                         │
//   │       WORLD VIEWPORT    │  ← world is clipped here. Camera centers
//   │       (camera follow)   │     the player inside this rect. D-pad and
//   │                         │     minimap LIVE BELOW, so they never sit
//   ├─────────────────────────┤     on top of the play area.
//   │  D-PAD   MAP   ACTIONS  │  ← canvas-rendered control band
//   └─────────────────────────┘
export const HUD_HEIGHT = 96;
export const CONTROL_HEIGHT = 200;
export const VIEWPORT_X = 0;
export const VIEWPORT_Y = HUD_HEIGHT;
export const VIEWPORT_W = CANVAS_WIDTH;
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
// Limited, melancholic palette per narrative tone (Section 11.1 of the brief).
export const COLOR = Object.freeze({
  bg: '#0a0a0c',
  void: '#000000',
  wallLit: '#3a3340',
  wallDim: '#1a1820',
  floorLit: '#2a2630',
  floorDim: '#15131a',
  stairs: '#c9b27c',
  door: '#6a4a2a',

  player: '#d6d6da',
  enemy: '#a04050',
  enemyRanged: '#6a90b0',
  enemyTank: '#8a7050',
  enemyErratic: '#7050a0',
  enemyPhase: '#5a3050',

  itemCommon: '#cccccc',
  itemUncommon: '#5ac06a',
  itemRare: '#5a8ed8',
  itemEpic: '#b070d8',

  textPrimary: '#d6d6da',
  textMuted: '#7a7884',
  textCrit: '#ff5050',
  textHeal: '#60d070',
  textXP: '#d0c050',

  hpBar: '#a02020',
  hpBarBg: '#3a0a0a',
  xpBar: '#d0c050',
  xpBarBg: '#3a3010'
});

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

/**
 * SpriteRegistry — single chokepoint for all on-screen art.
 *
 * v0.1: every "sprite" is a procedural draw (colored rect + small accent
 *        shape). Cheap, zero asset weight, ships TODAY.
 * v0.3: replace `_drawProcedural` body with `drawImage` from a spritesheet.
 *        Every caller is `registry.draw(key, ctx, x, y, opts)` — they don't
 *        change.
 *
 * Sprite keys live in items.json / enemies.json so adding a new sprite is a
 * data edit + (optionally) a new entry in PROCEDURAL_SPRITES if you want it
 * to look special. Unknown keys fall back to a magenta box — visible bug.
 */
import { TILE_SIZE, COLOR } from '../config/constants.js';

const FALLBACK_COLOR = '#ff00ff';

/**
 * Each entry returns how to draw a TILE_SIZE×TILE_SIZE icon. Functions get
 * (ctx, x, y, size, opts) where (x, y) is the top-left in pixels.
 *
 * Keep these small — the cost of changing the look later is just editing the
 * one function here.
 */
// Pixel-art helper: lets sprite designs use a 32-unit subgrid so they read
// like crisp pixel art regardless of TILE_SIZE. p() scales a "design pixel"
// to canvas pixels.
function pixelDraw(ctx, ox, oy, size, pixels) {
  const p = size / 32;
  for (const [px, py, pw, ph, color] of pixels) {
    fillRect(ctx, ox + px * p, oy + py * p, pw * p, ph * p, color);
  }
}

// Same helper but on a 64-unit subgrid — for larger detail portraits
// used in screens like the Vigil character sheet.
function pixelDraw64(ctx, ox, oy, size, pixels) {
  const p = size / 64;
  for (const [px, py, pw, ph, color] of pixels) {
    fillRect(ctx, ox + px * p, oy + py * p, pw * p, ph * p, color);
  }
}

// Palette for the hero (consistent across all hero-related sprites).
const HERO_HELMET   = '#3e3a48';
const HERO_HELM_HI  = '#5e5868';
const HERO_VISOR    = '#0a0810';
const HERO_EYE      = '#ff5a3a';
const HERO_ARMOR    = '#5a5468';
const HERO_ARMOR_HI = '#7a7484';
const HERO_BELT     = '#1a1820';
const HERO_PAULDRON = '#7a6a4a';
const HERO_EMBLEM   = '#d0c050';
const HERO_LEG      = '#3a3540';
const HERO_BOOT     = '#161018';
const HERO_BLADE    = '#d8d8e0';
const HERO_BLADE_HI = '#ffffff';
const HERO_HILT     = '#5a3a1e';
const HERO_GUARD    = '#a07040';
const HERO_CAPE     = '#7a1a28';
const HERO_CAPE_HI  = '#a02a30';

const PROCEDURAL_SPRITES = {
  // --- entities -----------------------------------------------------
  player_idle: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      // Cape behind (wider at bottom).
      [10, 14, 12, 2, HERO_CAPE],
      [ 9, 16, 14, 8, HERO_CAPE],
      [ 8, 24, 16, 4, HERO_CAPE],
      [10, 16, 12, 1, HERO_CAPE_HI], // cape highlight near shoulder
      // Helmet.
      [11,  3, 10, 6, HERO_HELMET],
      [10,  8, 12, 2, HERO_HELM_HI],
      // Visor band + glowing red eyes.
      [11, 10, 10, 3, HERO_VISOR],
      [13, 11,  2, 2, HERO_EYE],
      [17, 11,  2, 2, HERO_EYE],
      // Neck.
      [14, 13,  4, 1, HERO_HELMET],
      // Pauldrons + shoulders.
      [ 7, 14,  4, 4, HERO_PAULDRON],
      [21, 14,  4, 4, HERO_PAULDRON],
      [11, 14, 10, 1, HERO_ARMOR_HI],
      // Chest plate.
      [10, 15, 12, 8, HERO_ARMOR],
      [11, 15, 10, 1, HERO_ARMOR_HI],
      [15, 17,  2, 4, HERO_EMBLEM], // chest emblem
      [11, 22, 10, 1, HERO_BELT],   // belt
      // Legs.
      [11, 23,  4, 6, HERO_LEG],
      [17, 23,  4, 6, HERO_LEG],
      [11, 23,  4, 1, HERO_BELT],
      [17, 23,  4, 1, HERO_BELT],
      // Boots.
      [10, 29,  6, 2, HERO_BOOT],
      [16, 29,  6, 2, HERO_BOOT],
      // Sword in the right hand (out front of body).
      [24,  7,  2, 18, HERO_BLADE],
      [24,  7,  1, 18, HERO_BLADE_HI],
      [22, 24,  6,  2, HERO_GUARD], // cross-guard
      [25, 26,  1,  3, HERO_HILT],
      [24, 29,  3,  1, HERO_HILT]   // pommel
    ]);
  },
  enemy_goblin: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13,  7,  6, 5, '#4a6a3a'], // head
      [12, 12,  8, 1, '#2a4a20'], // jaw shadow
      [11, 10,  2, 2, '#4a6a3a'], // left ear
      [19, 10,  2, 2, '#4a6a3a'],
      [14,  9,  1, 1, '#ffff80'], // eyes
      [17,  9,  1, 1, '#ffff80'],
      [11, 13, 10, 8, '#7a3838'], // body
      [13, 14,  6, 1, '#a04040'], // chest highlight
      [12, 21,  3, 6, '#3a3a40'],
      [17, 21,  3, 6, '#3a3a40'],
      [11, 27,  4, 2, '#1a1a1e'],
      [17, 27,  4, 2, '#1a1a1e'],
      [21, 16,  3, 1, '#a07040'], // dagger
      [22, 17,  1, 5, '#c8c8d0']
    ]);
  },
  enemy_skeleton_archer: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13,  5,  6, 5, '#e8e6dc'], // skull
      [13, 10,  6, 1, '#bcb8a8'],
      [14,  7,  1, 1, '#0a0a0a'], // eye sockets
      [17,  7,  1, 1, '#0a0a0a'],
      [15,  9,  2, 1, '#0a0a0a'], // nose
      [12, 11,  8, 2, '#bcb8a8'], // collar
      [11, 13,  4, 9, '#e8e6dc'], // ribs left
      [17, 13,  4, 9, '#e8e6dc'], // ribs right
      [14, 14,  4, 7, '#8a8478'], // spine
      [13, 22,  3, 7, '#e8e6dc'], // legs
      [17, 22,  3, 7, '#e8e6dc'],
      [12, 29,  4, 1, '#1a1a1e'],
      [16, 29,  4, 1, '#1a1a1e'],
      [22, 10,  1, 12, '#c0a060'], // bow
      [21, 11,  1,  2, '#c0a060'],
      [21, 19,  1,  2, '#c0a060'],
      [22, 15,  1,  3, '#a08040'], // grip
      [23, 16,  2,  1, '#a08040']  // arrow
    ]);
  },
  enemy_bat: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13, 13,  6, 4, '#3a2a44'], // body
      [14, 17,  4, 2, '#2a1a30'], // belly
      [15, 11,  2, 2, '#2a1a30'], // head shadow
      [14, 14,  1, 1, '#ff6060'], // eyes
      [17, 14,  1, 1, '#ff6060'],
      [ 5, 12,  8, 1, '#3a2a44'], // left wing top
      [ 3, 13, 10, 4, '#2a1a30'], // left wing
      [ 6, 17,  5, 1, '#3a2a44'],
      [19, 12,  8, 1, '#3a2a44'], // right wing top
      [19, 13, 10, 4, '#2a1a30'],
      [21, 17,  5, 1, '#3a2a44']
    ]);
  },
  enemy_golem: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [ 8,  6, 16, 4, '#7a6a4e'], // head/shoulder
      [ 9,  6, 14, 1, '#a08868'], // top highlight
      [10, 11,  3, 2, '#1a1410'], // left eye socket
      [19, 11,  3, 2, '#1a1410'], // right eye socket
      [11, 12,  1, 1, '#ff8030'], // eye glow
      [20, 12,  1, 1, '#ff8030'],
      [ 7, 14, 18, 12, '#7a6a4e'], // torso
      [ 8, 15, 16, 1, '#a08868'],
      [12, 18,  8, 4, '#5a4a32'], // armor chest panel
      [ 9, 22, 14, 1, '#5a4a32'], // belt
      [ 7, 26,  6, 5, '#5a4a32'], // legs
      [19, 26,  6, 5, '#5a4a32'],
      [ 7, 30,  6, 1, '#1a1410'],
      [19, 30,  6, 1, '#1a1410']
    ]);
  },
  enemy_wraith: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10,  5, 12, 4, '#7050a0'], // hood top
      [ 9,  8, 14, 6, '#5a3080'], // hood
      [11, 14, 10, 4, '#0a0418'], // face shadow
      [13, 15,  2, 2, '#ff80c0'], // glowing eyes
      [17, 15,  2, 2, '#ff80c0'],
      [ 8, 16, 16, 6, '#5a3080'], // robe upper
      [ 7, 22, 18, 6, '#3a1860'], // robe lower
      [ 8, 28, 16, 2, '#28104a'], // bottom fade
      [10, 30,  3, 1, '#28104a'],
      [14, 30,  4, 1, '#28104a'],
      [19, 30,  3, 1, '#28104a']
    ]);
  },

  // --- v0.3 monsters (biome-driven) -----------------------------------
  enemy_lurker: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10,  8, 12, 6, '#1c3a48'], [11, 14, 10, 8, '#0e2a36'],
      [11, 22,  3, 6, '#0e2a36'], [18, 22,  3, 6, '#0e2a36'],
      [13, 11,  2, 2, '#80ffff'], [17, 11,  2, 2, '#80ffff'],
      [12, 14,  8, 1, '#3a8090'], [11, 28, 10, 2, '#04181e']
    ]);
  },
  enemy_rotbringer: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [12,  6,  8, 6, '#7a8e3a'], [11, 12, 10, 2, '#5a6e20'],
      [11, 14, 10, 10, '#5a6e20'], [14,  9,  1, 1, '#ffff60'],
      [17,  9,  1, 1, '#ffff60'], [12, 16,  3, 2, '#3a4e10'],
      [17, 16,  3, 2, '#3a4e10'], [12, 24,  3, 6, '#5a4a20'],
      [17, 24,  3, 6, '#5a4a20'], [11, 30,  4, 1, '#1a1410']
    ]);
  },
  enemy_imp: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [12,  4,  3, 4, '#a04020'], [17,  4,  3, 4, '#a04020'], // horns
      [11,  8, 10, 6, '#d04018'], [10, 14, 12, 6, '#a02818'],
      [13, 10,  2, 2, '#ffff00'], [17, 10,  2, 2, '#ffff00'],
      [12, 20,  3, 7, '#601810'], [17, 20,  3, 7, '#601810'],
      [11, 27,  4, 2, '#1a0a08'], [17, 27,  4, 2, '#1a0a08'],
      [22, 18,  2,  6, '#ff8030'], [23, 24,  2, 2, '#ff8030'] // tail flame
    ]);
  },
  enemy_warden: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [ 9,  4, 14, 5, '#3a3038'], [ 8,  9, 16, 2, '#5a4850'],
      [11, 13,  3, 2, '#ff6010'], [18, 13,  3, 2, '#ff6010'],
      [ 7, 13, 18, 10, '#3a3038'], [ 9, 16, 14, 5, '#5a4850'],
      [11, 22,  4, 8, '#2a2028'], [17, 22,  4, 8, '#2a2028'],
      [10, 29,  6, 2, '#0a0408'], [16, 29,  6, 2, '#0a0408']
    ]);
  },
  enemy_thrall: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [11,  6, 10, 6, '#c0c8d8'], [10, 12, 12, 4, '#8090a8'],
      [13,  9,  2, 2, '#000000'], [17,  9,  2, 2, '#000000'],
      [10, 16, 12, 8, '#c0c8d8'], [11, 24,  3, 5, '#6080a0'],
      [18, 24,  3, 5, '#6080a0'], [11, 17, 10, 1, '#ffffff'],
      [12, 19,  8, 1, '#a0a8c0']
    ]);
  },
  enemy_scribe: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10,  4, 12, 4, '#0a0a18'], [10, 8, 12, 6, '#1a1a28'],
      [13,  9,  2, 2, '#a060ff'], [17,  9,  2, 2, '#a060ff'],
      [ 9, 14, 14, 12, '#0a0a18'], [10, 16, 12, 2, '#1a1a30'],
      [10, 22, 12, 1, '#3a2a18'], [10, 26, 12, 4, '#0a0a18'],
      [22, 12,  2, 8, '#3a3a18'] // quill
    ]);
  },
  enemy_revenant: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [12,  4,  8, 5, '#a0c8d8'], [11,  9, 10, 4, '#80a8c0'],
      [13, 10,  2, 2, '#80ffff'], [17, 10,  2, 2, '#80ffff'],
      [10, 13, 12, 10, '#a0c8d8'], [11, 23,  4, 7, '#6890a8'],
      [17, 23,  4, 7, '#6890a8'], [10, 30,  4, 1, '#1a1820'],
      [18, 30,  4, 1, '#1a1820'], [13, 16,  6, 4, '#c8e0f0'] // frost emblem
    ]);
  },
  enemy_fiend: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [12,  5,  8, 4, '#7a1020'], [11,  9, 10, 6, '#5a0810'],
      [13, 10,  2, 2, '#ff4040'], [17, 10,  2, 2, '#ff4040'],
      [10, 15, 12, 9, '#3a0810'], [13, 16,  6, 5, '#7a1020'],
      [11, 24,  4, 6, '#28040a'], [17, 24,  4, 6, '#28040a'],
      [ 8, 20,  3, 2, '#5a0810'], [21, 20,  3, 2, '#5a0810'] // claw arms
    ]);
  },
  enemy_sentinel: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10,  3, 12, 6, '#4a4858'], [ 9,  9, 14, 3, '#7a7888'],
      [12, 11,  3, 1, '#ff8000'], [17, 11,  3, 1, '#ff8000'],
      [ 8, 12, 16, 12, '#4a4858'], [10, 14, 12, 8, '#7a7888'],
      [14, 16,  4, 4, '#d0c878'], // shield boss
      [10, 24,  5, 6, '#2a2838'], [17, 24,  5, 6, '#2a2838'],
      [ 9, 30,  6, 1, '#000000'], [17, 30,  6, 1, '#000000']
    ]);
  },
  enemy_hound: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [14, 10,  4, 4, '#3a2848'], // head
      [12, 14, 12, 6, '#3a2848'], // body
      [13, 11,  1, 1, '#ff5050'], [16, 11,  1, 1, '#ff5050'],
      [10, 11,  3, 2, '#3a2848'], [13,  9,  2, 2, '#3a2848'], // ears
      [11, 18,  3, 6, '#3a2848'], [21, 18,  3, 6, '#3a2848'], // legs
      [11, 23,  3, 1, '#000'], [21, 23,  3, 1, '#000'],
      [23, 14,  3, 1, '#3a2848'] // tail
    ]);
  },
  enemy_marcher: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [11,  3,  4, 6, '#a09060'], [13,  9,  6, 3, '#a09060'], // plume + helm
      [11, 12, 10, 4, '#3a3848'], [13, 14,  2, 1, '#ff6020'],
      [17, 14,  2, 1, '#ff6020'], [10, 16, 12, 8, '#3a3848'],
      [11, 18, 10, 1, '#5a5868'], [12, 24,  4, 6, '#2a2838'],
      [16, 24,  4, 6, '#2a2838'], [22, 8, 2, 18, '#d0c0a0'] // spear
    ]);
  },
  enemy_wyrm: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13,  6,  6, 3, '#5a3818'], // head
      [12,  9,  8, 4, '#7a5028'],
      [14, 10,  1, 1, '#ffff00'], [17, 10,  1, 1, '#ffff00'],
      [11, 13, 10, 4, '#7a5028'], // body coil 1
      [13, 17,  8, 4, '#5a3818'], // coil 2
      [10, 21, 10, 4, '#7a5028'], // coil 3
      [12, 25,  8, 5, '#5a3818'], // coil 4
      [22, 16,  2, 3, '#7a5028'] // tail tip
    ]);
  },
  enemy_called: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10,  2, 12, 5, '#1a0828'], // crown / mass
      [ 8,  7, 16, 8, '#28104a'],
      [11,  9,  2, 3, '#ff10ff'], [19,  9,  2, 3, '#ff10ff'], // 2 eyes
      [ 7, 15, 18, 10, '#3a1860'],
      [13, 18,  6, 4, '#ff10a0'], // chest void
      [ 8, 25, 16, 4, '#1a0828'],
      [ 9, 29,  4, 2, '#0a0214'], [13, 29, 4, 2, '#0a0214'],
      [17, 29,  4, 2, '#0a0214'], [21, 29, 2, 2, '#0a0214']
    ]);
  },

  // --- tiles --------------------------------------------------------
  tile_wall: (ctx, x, y, s, opts) => {
    fillRect(ctx, x, y, s, s, opts?.dim ? COLOR.wallDim : COLOR.wallLit);
    // subtle brick lines for texture
    strokeRect(ctx, x, y, s, s, '#000000', 1);
  },
  tile_floor: (ctx, x, y, s, opts) => {
    fillRect(ctx, x, y, s, s, opts?.dim ? COLOR.floorDim : COLOR.floorLit);
  },
  tile_stairs_down: (ctx, x, y, s) => {
    fillRect(ctx, x, y, s, s, COLOR.floorLit);
    for (let i = 0; i < 4; i++) {
      const w = s * (0.8 - i * 0.15);
      fillRect(ctx, x + (s - w) / 2, y + s * 0.2 + i * (s * 0.15), w, s * 0.08, COLOR.stairs);
    }
  },
  tile_stairs_up: (ctx, x, y, s) => {
    fillRect(ctx, x, y, s, s, COLOR.floorLit);
    for (let i = 0; i < 4; i++) {
      const w = s * (0.25 + i * 0.15);
      fillRect(ctx, x + (s - w) / 2, y + s * 0.2 + i * (s * 0.15), w, s * 0.08, '#a09060');
    }
  },
  tile_door: (ctx, x, y, s) => {
    fillRect(ctx, x, y, s, s, COLOR.floorLit);
    fillRect(ctx, x + s * 0.3, y + s * 0.1, s * 0.4, s * 0.8, COLOR.door);
  },

  // --- ranged weapons ----------------------------------------------
  weapon_bow: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13,  6, 1, 2, '#c0a060'], [12,  8, 1, 3, '#c0a060'],
      [11, 11, 1, 4, '#a08040'], [11, 17, 1, 4, '#a08040'],
      [12, 21, 1, 3, '#c0a060'], [13, 24, 1, 2, '#c0a060'],
      [12, 11, 8, 1, '#e0d8a0'], // string
      [18, 12, 1, 8, '#e0d8a0']  // arrow shaft
    ]);
  },
  weapon_longbow: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13,  4, 1, 3, '#8a6030'], [12,  7, 1, 4, '#8a6030'],
      [11, 11, 1, 4, '#a07840'], [11, 17, 1, 4, '#a07840'],
      [12, 21, 1, 4, '#8a6030'], [13, 25, 1, 3, '#8a6030'],
      [12, 12, 9, 1, '#fff0c0'],
      [19, 13, 1, 6, '#fff0c0']
    ]);
  },
  weapon_crossbow: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [12, 14,  8, 3, '#5a3a18'],   // stock
      [10, 12,  2, 7, '#7a5028'],
      [20, 12,  2, 7, '#7a5028'],
      [11, 14, 10, 1, '#c0a060'],   // bow arms
      [15, 11,  2, 4, '#c0c8d0']   // bolt loaded
    ]);
  },
  weapon_throwaxe: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [14,  8,  2, 16, '#5a3a18'],
      [11, 10,  3, 5, '#c8c8d0'],
      [10, 11,  1, 3, '#a0a0a8'],
      [16, 10,  3, 5, '#c8c8d0'],
      [19, 11,  1, 3, '#a0a0a8']
    ]);
  },
  weapon_boomerang: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10, 12, 2, 8, '#d6c8a0'],
      [12, 18, 8, 2, '#d6c8a0'],
      [18, 12, 2, 6, '#d6c8a0'],
      [12, 10, 6, 2, '#d6c8a0'],
      [11, 13, 1, 5, '#a09870']
    ]);
  },
  // --- High-detail hero portrait (for Vigil screen, 64-unit subgrid) ---
  portrait_hero: (ctx, x, y, s) => {
    pixelDraw64(ctx, x, y, s, [
      // Cape behind (drapes outside helmet/shoulders).
      [16, 24,  4,  3, HERO_CAPE],
      [44, 24,  4,  3, HERO_CAPE],
      [14, 27, 36, 22, HERO_CAPE],
      [12, 49, 40, 12, HERO_CAPE],
      [14, 29, 36,  2, HERO_CAPE_HI], // cape shoulder highlight

      // Helmet — top dome
      [22,  4, 20, 10, HERO_HELMET],
      [21,  6, 22,  2, HERO_HELM_HI], // helm highlight
      [22, 14, 20,  3, HERO_HELM_HI],

      // Visor band
      [22, 17, 20,  6, HERO_VISOR],

      // Glowing red eyes — bigger, more menacing
      [26, 19,  3,  3, HERO_EYE],
      [35, 19,  3,  3, HERO_EYE],
      [27, 20,  1,  1, '#ffffff'], // eye sparkle
      [36, 20,  1,  1, '#ffffff'],

      // Chin / lower jaw guard
      [24, 23, 16,  3, HERO_HELMET],
      [26, 26, 12,  1, HERO_HELM_HI],

      // Neck gorget
      [27, 27, 10,  2, HERO_ARMOR_HI],

      // Pauldrons (shoulder armor) — large and ornate
      [12, 29,  8,  9, HERO_PAULDRON],
      [44, 29,  8,  9, HERO_PAULDRON],
      [13, 30,  6,  1, '#a08850'], // pauldron rim
      [45, 30,  6,  1, '#a08850'],
      [14, 32,  4,  2, '#5a4a20'], // pauldron rivet
      [46, 32,  4,  2, '#5a4a20'],

      // Chest plate
      [20, 30, 24, 18, HERO_ARMOR],
      [21, 30, 22,  2, HERO_ARMOR_HI], // chest top trim
      [20, 47, 24,  1, HERO_BELT],     // belt line below chest

      // Chest emblem — large gold sun/eye
      [30, 35,  4,  4, HERO_EMBLEM],
      [29, 36,  1,  2, HERO_EMBLEM],
      [34, 36,  1,  2, HERO_EMBLEM],
      [31, 34,  2,  1, HERO_EMBLEM],
      [31, 39,  2,  1, HERO_EMBLEM],

      // Chest ornament rivets
      [22, 33,  2,  2, '#1a1018'],
      [40, 33,  2,  2, '#1a1018'],
      [22, 42,  2,  2, '#1a1018'],
      [40, 42,  2,  2, '#1a1018'],

      // Belt + buckle
      [22, 48, 20,  4, HERO_BELT],
      [29, 49,  6,  2, HERO_EMBLEM], // belt buckle gold
      [30, 50,  4,  1, '#3a2e10'],

      // Vignette glow at bottom (subtle frame edge dark)
      [ 0, 62, 64,  2, '#0a0608']
    ]);
  },

  weapon_voidbow: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13,  4, 1, 3, '#9050c0'], [12,  7, 1, 4, '#9050c0'],
      [11, 11, 1, 4, '#7038a0'], [11, 17, 1, 4, '#7038a0'],
      [12, 21, 1, 4, '#9050c0'], [13, 25, 1, 3, '#9050c0'],
      [12, 12, 9, 1, '#ff80ff'],
      [19, 13, 1, 6, '#c060ff']
    ]);
  },

  // --- helmets -----------------------------------------------------
  helm_leather: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10, 10, 12, 6, '#7a5a30'], [10, 16, 12, 2, '#5a3a18'],
      [11, 11, 10, 1, '#a07a40']
    ]);
  },
  helm_iron: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10,  9, 12, 8, '#7a7884'], [10, 17, 12, 2, '#3a3848'],
      [14, 13,  4, 4, '#1a1820'], [10, 10, 12, 1, '#bcb8c8']
    ]);
  },
  helm_hood: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [ 9,  8, 14, 4, '#2a2238'], [ 8, 12, 16, 6, '#1a1428'],
      [12, 14,  8, 3, '#000000'], [ 8, 18,  4, 4, '#2a2238'],
      [20, 18,  4, 4, '#2a2238']
    ]);
  },
  helm_horned: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10, 11, 12, 6, '#5a4848'], [11, 17, 10, 2, '#2a1a1a'],
      [ 7,  5,  3, 8, '#d0c0a0'], [22,  5,  3, 8, '#d0c0a0'],
      [ 8,  4,  2, 2, '#d0c0a0'], [22,  4,  2, 2, '#d0c0a0'],
      [14, 14,  4, 3, '#1a0a0a']
    ]);
  },
  helm_crown: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10,  6,  2, 8, '#5a3030'], [13,  4,  2, 8, '#5a3030'],
      [16,  4,  2, 8, '#5a3030'], [19,  6,  2, 8, '#5a3030'],
      [10, 14, 12, 4, '#7a3838'], [11, 15, 10, 1, '#a04040'],
      [12,  8,  1, 1, '#d04848'], [17,  8,  1, 1, '#d04848']
    ]);
  },
  helm_circlet: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [10, 11, 12, 4, '#d8d0a0'], [11, 12, 10, 1, '#ffffd0'],
      [15,  9,  2, 4, '#9050c0'], [14, 14,  4, 1, '#9050c0'],
      [10, 16, 12, 1, '#7a7430']
    ]);
  },

  // --- rings -------------------------------------------------------
  ring_tin: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13, 12,  6, 2, '#9090a0'], [13, 18,  6, 2, '#9090a0'],
      [11, 14,  2, 4, '#9090a0'], [19, 14,  2, 4, '#9090a0']
    ]);
  },
  ring_bone: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13, 12,  6, 2, '#e6dcc0'], [13, 18,  6, 2, '#e6dcc0'],
      [11, 14,  2, 4, '#e6dcc0'], [19, 14,  2, 4, '#e6dcc0'],
      [15, 14,  2, 2, '#3a1010']
    ]);
  },
  ring_vigor: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13, 12,  6, 2, '#c87878'], [13, 18,  6, 2, '#c87878'],
      [11, 14,  2, 4, '#c87878'], [19, 14,  2, 4, '#c87878'],
      [14, 14,  4, 4, '#ff5050']
    ]);
  },
  ring_speed: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13, 12,  6, 2, '#a0e0c0'], [13, 18,  6, 2, '#a0e0c0'],
      [11, 14,  2, 4, '#a0e0c0'], [19, 14,  2, 4, '#a0e0c0'],
      [14, 14,  4, 4, '#40ff80']
    ]);
  },
  ring_wards: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13, 12,  6, 2, '#80a0d0'], [13, 18,  6, 2, '#80a0d0'],
      [11, 14,  2, 4, '#80a0d0'], [19, 14,  2, 4, '#80a0d0'],
      [14, 14,  4, 4, '#4080ff']
    ]);
  },
  ring_called: (ctx, x, y, s) => {
    pixelDraw(ctx, x, y, s, [
      [13, 12,  6, 2, '#d0c050'], [13, 18,  6, 2, '#d0c050'],
      [11, 14,  2, 4, '#d0c050'], [19, 14,  2, 4, '#d0c050'],
      [14, 14,  4, 4, '#ff10ff'],
      [15, 15,  2, 2, '#ffffff']
    ]);
  }
};

export class SpriteRegistry {
  constructor() {
    this._sprites = PROCEDURAL_SPRITES;
  }

  /**
   * @param {string} key
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x top-left in pixels
   * @param {number} y top-left in pixels
   * @param {{ size?:number, dim?:boolean, tint?:string }} [opts]
   */
  draw(key, ctx, x, y, opts = {}) {
    const size = opts.size ?? TILE_SIZE;
    const fn = this._sprites[key];
    if (fn) {
      fn(ctx, x, y, size, opts);
      return;
    }
    // Inferred item draw: classify by key prefix and tint by rarity if given.
    this._drawInferredItem(key, ctx, x, y, size, opts);
  }

  _drawInferredItem(key, ctx, x, y, s, opts) {
    const tint = opts.tint || itemTintFromKey(key) || FALLBACK_COLOR;
    if (key.startsWith('weapon_')) {
      fillRect(ctx, x + s * 0.45, y + s * 0.15, s * 0.1, s * 0.6, tint);
      fillRect(ctx, x + s * 0.35, y + s * 0.7, s * 0.3, s * 0.1, '#5a4a30');
    } else if (key.startsWith('armor_')) {
      fillRect(ctx, x + s * 0.25, y + s * 0.25, s * 0.5, s * 0.55, tint);
      fillRect(ctx, x + s * 0.35, y + s * 0.2, s * 0.3, s * 0.1, tint);
    } else if (key.startsWith('potion_') || key.startsWith('vial_')) {
      fillRect(ctx, x + s * 0.35, y + s * 0.2, s * 0.3, s * 0.1, '#5a3a1a'); // cork
      fillRect(ctx, x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.5, tint);
    } else if (key.startsWith('bomb_')) {
      fillRect(ctx, x + s * 0.25, y + s * 0.3, s * 0.5, s * 0.5, tint);
      fillRect(ctx, x + s * 0.45, y + s * 0.15, s * 0.1, s * 0.15, '#3a2a10');
    } else if (key.startsWith('scroll_') || key.startsWith('paper_')) {
      fillRect(ctx, x + s * 0.2, y + s * 0.3, s * 0.6, s * 0.4, '#d8c890');
      fillRect(ctx, x + s * 0.2, y + s * 0.45, s * 0.6, s * 0.03, tint);
      fillRect(ctx, x + s * 0.2, y + s * 0.55, s * 0.6, s * 0.03, tint);
    } else if (key.startsWith('book_')) {
      fillRect(ctx, x + s * 0.25, y + s * 0.2, s * 0.5, s * 0.6, tint);
      fillRect(ctx, x + s * 0.5, y + s * 0.2, s * 0.03, s * 0.6, '#000');
    } else if (key.startsWith('crystal_') || key.startsWith('charm_')) {
      // diamond-ish
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y + s * 0.2);
      ctx.lineTo(x + s * 0.8, y + s * 0.5);
      ctx.lineTo(x + s * 0.5, y + s * 0.8);
      ctx.lineTo(x + s * 0.2, y + s * 0.5);
      ctx.closePath();
      ctx.fill();
    } else if (key.startsWith('pouch_')) {
      fillRect(ctx, x + s * 0.3, y + s * 0.35, s * 0.4, s * 0.45, tint);
      fillRect(ctx, x + s * 0.35, y + s * 0.3, s * 0.3, s * 0.1, '#5a4a30');
    } else {
      fillRect(ctx, x + s * 0.25, y + s * 0.25, s * 0.5, s * 0.5, tint);
    }
  }
}

// --- low-level helpers (also used by callers via re-export) -------------
export function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h));
}

export function strokeRect(ctx, x, y, w, h, color, line = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.strokeRect((x | 0) + 0.5, (y | 0) + 0.5, Math.ceil(w) - 1, Math.ceil(h) - 1);
}

/** Pick a tint for items whose sprite key encodes a hue (e.g. potion_red). */
function itemTintFromKey(key) {
  const map = {
    red: '#c04040', pink: '#e890c0', orange: '#d08040', yellow: '#d0c050',
    green: '#5ac06a', teal: '#40a0a0', blue: '#5a8ed8', dark_blue: '#3a5a90',
    dark_green: '#3a7a50', dark_red: '#7a2020', crimson: '#a02020',
    purple: '#9050c0', silver: '#c8c8d0', white: '#e0e0e8',
    grey: '#888892', black: '#202028', bone: '#d6c8a0', brown: '#7a5030',
    twin: '#d8c0d0', torn: '#a09870'
  };
  for (const word of key.split('_').reverse()) {
    if (map[word]) return map[word];
  }
  return null;
}

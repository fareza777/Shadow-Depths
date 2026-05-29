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
import { TILE_SIZE } from '../config/constants.js';
import { buildItemSprites, defaultTintForKey } from './itemSprites.js';
import { buildDungeonTileSprites } from './dungeonTiles.js';
import {
  buildPlayerSprites,
  HERO_ARMOR, HERO_ARMOR_HI, HERO_BELT, HERO_CAPE, HERO_CAPE_HI,
  HERO_EMBLEM, HERO_EYE, HERO_HELMET, HERO_HELM_HI, HERO_PAULDRON, HERO_VISOR
} from './playerSprites.js';
import { buildEnemySprites } from './enemySprites.js';
import { drawDetailedEnemySprite } from './enemySpritesDetailed.js';
import { drawVectorEnemy, preloadVectorEnemies } from './enemySpritesVector.jsx';
import { drawDetailedItemSprite } from './itemSpritesDetailed.js';
import { drawVectorItem, preloadItemArt, hasItemArt } from './itemArtVector.jsx';
import { drawVectorHero, preloadHeroArt } from './heroArtVector.jsx';
import { HERO_ORDER, drawHeroSprite, drawHeroEquipment } from './heroSprites.js';
import { paintWeaponAffix } from './weaponComposer.js';

const FALLBACK_COLOR = '#9a8a78';

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
const PROCEDURAL_SPRITES = {
  // --- entities (hero + enemies) ------------------------------------
  ...buildPlayerSprites(pixelDraw),
  ...buildEnemySprites(pixelDraw),

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

// Hero sprite variants — one entry per kind. Each kind also doubles as
// the Vigil-screen portrait (same grid, just rendered larger).
const HERO_SPRITES = {};
// Prefer the detailed vector hero art; fall back to the legacy 32×32 grid
// until each raster has decoded (or in non-DOM contexts like tests).
function drawHeroBase(ctx, x, y, s, kind) {
  if (!drawVectorHero(ctx, x, y, s, kind)) drawHeroSprite(ctx, x, y, s, kind);
}
for (const kind of HERO_ORDER) {
  HERO_SPRITES[`hero_${kind}`] = (ctx, x, y, s, opts = {}) => {
    drawHeroBase(ctx, x, y, s, kind);
    drawHeroEquipment(ctx, x, y, s, opts.entity, opts.time);
  };
  // Portrait variant skips equipment overlay so the character-select
  // and Vigil screens still show the canonical hero silhouette.
  HERO_SPRITES[`portrait_${kind}`] = (ctx, x, y, s) => drawHeroBase(ctx, x, y, s, kind);
}

export class SpriteRegistry {
  constructor() {
    this._sprites = {
      ...PROCEDURAL_SPRITES,
      ...buildItemSprites(),
      ...buildDungeonTileSprites(),
      ...HERO_SPRITES
    };
    // Warm the vector sprite engines so they're decoded before they're first
    // needed (each falls back to its legacy sprite until ready).
    preloadVectorEnemies();
    preloadItemArt();
    preloadHeroArt();
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
    if (typeof key !== 'string' || key.length === 0) {
      // Defensive — never throw on bad sprite keys. Paint a magenta box
      // so the asset gap is loud but the frame keeps rendering.
      fillRect(ctx, x, y, size, size, '#ff00ff');
      return;
    }

    // Enemy art: prefer the per-id vector sprite engine (matches the
    // enemy-sprites design 1:1), then fall back to the legacy 32×32 grid
    // when the vector raster isn't ready yet or no enemy id is supplied.
    if (key.startsWith('enemy_') || key.startsWith('boss_') || key.startsWith('subboss_')) {
      const enemyId = opts.enemyId || opts.entity?.defId;
      if (enemyId && drawVectorEnemy(ctx, x, y, size, enemyId)) {
        return;
      }
      if (drawDetailedEnemySprite(ctx, x, y, size, key)) {
        return;
      }
    }

    // Item art: prefer the composable vector engine (matches the item-armory
    // design), falling back to the detailed/procedural sprites until the
    // raster decodes. Weapon affix overlays still apply below.
    if (hasItemArt(key) && drawVectorItem(ctx, x, y, size, key)) {
      if (opts.affixes && key.startsWith('weapon_')) {
        paintWeaponAffix(ctx, x, y, size, opts.affixes);
      }
      return;
    }

    // Detailed item grids override procedural item art when defined
    if (drawDetailedItemSprite(ctx, x, y, size, key)) {
      return;
    }

    const fn = this._sprites[key];
    if (fn) {
      fn(ctx, x, y, size, opts);
    } else {
      // Inferred item draw: classify by key prefix and tint by rarity if given.
      this._drawInferredItem(key, ctx, x, y, size, opts);
    }
    // Affix overlay for weapons — adds gem socket (prefix) + blade glow
    // (suffix) so a rolled item is visually distinct from its base.
    if (opts.affixes && (key === 'player_sword' || key.startsWith('weapon_'))) {
      paintWeaponAffix(ctx, x, y, size, opts.affixes);
    }
  }

  _drawInferredItem(key, ctx, x, y, s, opts) {
    const tint = opts.tint || defaultTintForKey(key) || FALLBACK_COLOR;
    if (key.startsWith('weapon_')) {
      fillRect(ctx, x + s * 0.45, y + s * 0.15, s * 0.1, s * 0.6, tint);
      fillRect(ctx, x + s * 0.35, y + s * 0.7, s * 0.3, s * 0.1, '#5a4a30');
    } else if (key.startsWith('armor_')) {
      fillRect(ctx, x + s * 0.25, y + s * 0.25, s * 0.5, s * 0.55, tint);
      fillRect(ctx, x + s * 0.35, y + s * 0.2, s * 0.3, s * 0.1, tint);
    } else if (key.startsWith('legs_')) {
      fillRect(ctx, x + s * 0.28, y + s * 0.24, s * 0.18, s * 0.52, tint);
      fillRect(ctx, x + s * 0.54, y + s * 0.24, s * 0.18, s * 0.52, tint);
      fillRect(ctx, x + s * 0.24, y + s * 0.74, s * 0.24, s * 0.12, '#2a1e18');
      fillRect(ctx, x + s * 0.52, y + s * 0.74, s * 0.24, s * 0.12, '#2a1e18');
      fillRect(ctx, x + s * 0.3, y + s * 0.28, s * 0.13, s * 0.12, '#ffffff44');
      fillRect(ctx, x + s * 0.56, y + s * 0.28, s * 0.13, s * 0.12, '#ffffff44');
    } else if (key.startsWith('necklace_') || key.startsWith('amulet_')) {
      ctx.strokeStyle = '#d4be7a';
      ctx.lineWidth = Math.max(1, Math.floor(s * 0.05));
      ctx.beginPath();
      ctx.arc(x + s * 0.5, y + s * 0.36, s * 0.24, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.5, y + s * 0.46);
      ctx.lineTo(x + s * 0.66, y + s * 0.62);
      ctx.lineTo(x + s * 0.5, y + s * 0.8);
      ctx.lineTo(x + s * 0.34, y + s * 0.62);
      ctx.closePath();
      ctx.fill();
      fillRect(ctx, x + s * 0.45, y + s * 0.52, s * 0.1, s * 0.08, '#ffffff66');
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

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
const PROCEDURAL_SPRITES = {
  // --- entities -----------------------------------------------------
  player_idle: (ctx, x, y, s) => {
    fillRect(ctx, x + s * 0.3, y + s * 0.15, s * 0.4, s * 0.7, COLOR.player);
    fillRect(ctx, x + s * 0.25, y + s * 0.2, s * 0.5, s * 0.1, '#5a5a60'); // shoulders
    fillRect(ctx, x + s * 0.4, y + s * 0.25, s * 0.2, s * 0.1, '#1a1a1e');  // visor slit
  },
  enemy_goblin: (ctx, x, y, s) => {
    fillRect(ctx, x + s * 0.3, y + s * 0.35, s * 0.4, s * 0.5, COLOR.enemy);
    fillRect(ctx, x + s * 0.35, y + s * 0.2, s * 0.3, s * 0.2, '#7a3030');
    fillRect(ctx, x + s * 0.4, y + s * 0.25, s * 0.05, s * 0.05, '#ffff80');
    fillRect(ctx, x + s * 0.55, y + s * 0.25, s * 0.05, s * 0.05, '#ffff80');
  },
  enemy_skeleton_archer: (ctx, x, y, s) => {
    fillRect(ctx, x + s * 0.3, y + s * 0.15, s * 0.4, s * 0.7, COLOR.enemyRanged);
    fillRect(ctx, x + s * 0.35, y + s * 0.18, s * 0.3, s * 0.18, '#e6e6e8');
    // bow accent
    strokeRect(ctx, x + s * 0.7, y + s * 0.25, s * 0.1, s * 0.5, '#c0a060', 2);
  },
  enemy_bat: (ctx, x, y, s) => {
    fillRect(ctx, x + s * 0.4, y + s * 0.35, s * 0.2, s * 0.3, COLOR.enemyErratic);
    fillRect(ctx, x + s * 0.15, y + s * 0.3, s * 0.25, s * 0.1, COLOR.enemyErratic);
    fillRect(ctx, x + s * 0.6, y + s * 0.3, s * 0.25, s * 0.1, COLOR.enemyErratic);
  },
  enemy_golem: (ctx, x, y, s) => {
    fillRect(ctx, x + s * 0.15, y + s * 0.15, s * 0.7, s * 0.7, COLOR.enemyTank);
    fillRect(ctx, x + s * 0.25, y + s * 0.25, s * 0.15, s * 0.15, '#3a3020');
    fillRect(ctx, x + s * 0.6, y + s * 0.25, s * 0.15, s * 0.15, '#3a3020');
    fillRect(ctx, x + s * 0.3, y + s * 0.55, s * 0.4, s * 0.08, '#1a1410');
  },
  enemy_wraith: (ctx, x, y, s) => {
    // Drifty ghost — gradient-ish vertical fade via two rects.
    fillRect(ctx, x + s * 0.25, y + s * 0.2, s * 0.5, s * 0.4, COLOR.enemyPhase);
    fillRect(ctx, x + s * 0.3, y + s * 0.6, s * 0.4, s * 0.2, '#2a1830');
    fillRect(ctx, x + s * 0.4, y + s * 0.3, s * 0.05, s * 0.08, '#ff80a0');
    fillRect(ctx, x + s * 0.55, y + s * 0.3, s * 0.05, s * 0.08, '#ff80a0');
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

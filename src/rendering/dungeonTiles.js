/**
 * Dungeon tile pixel art — natural stone walls & flagstone floors.
 */
function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h));
}

function shade(hex, n) {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + n));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + n));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + n));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hash2(tx, ty, salt = 0) {
  let h = ((tx * 92837111) ^ (ty * 689287499) ^ salt) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

function p(ctx, ox, oy, s, pixels) {
  const u = s / 32;
  for (const [px, py, pw, ph, col] of pixels) {
    fillRect(ctx, ox + px * u, oy + py * u, Math.max(1, pw * u), Math.max(1, ph * u), col);
  }
}

/** @param {{ wallLit:string, wallDim:string, floorLit:string, floorDim:string, biomeId?:string }} pal */
function wallPalette(pal, dim) {
  const lit = pal.wallLit || '#4a4258';
  const base = dim ? (pal.wallDim || '#1c1822') : lit;
  return {
    base,
    hi: shade(base, dim ? 8 : 28),
    lo: shade(base, dim ? -12 : -32),
    mid: shade(base, dim ? -4 : 12),
    dark: shade(base, dim ? -20 : -22),
    mortar: shade(base, dim ? -28 : -18),
    moss: biomeMoss(pal.biomeId, dim)
  };
}

function biomeMoss(id, dim) {
  if (dim) return null;
  if (!id) return null;
  if (id.includes('garden') || id.includes('bloodroot') || id.includes('veiled')) return '#3a5a30';
  if (id.includes('drowning') || id.includes('sunken')) return '#2a4a48';
  if (id.includes('frost') || id.includes('salt')) return '#4a5a68';
  if (id.includes('ashen') || id.includes('cinder')) return '#4a4030';
  return null;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} s
 * @param {{ tileX:number, tileY:number, dim?:boolean, wallLit?:string, wallDim?:string, biomeId?:string,
 *   adjFloor?:{n:boolean,s:boolean,e:boolean,w:boolean} }} opts
 */
export function drawWallTile(ctx, x, y, s, opts = {}) {
  const tx = opts.tileX ?? 0;
  const ty = opts.tileY ?? 0;
  const c = wallPalette(opts, !!opts.dim);
  const h = hash2(tx, ty);
  const variant = h % 4;
  const adj = opts.adjFloor || { n: false, s: false, e: false, w: false };

  fillRect(ctx, x, y, s, s, c.dark);

  // Face toward open floor — lighter "inner" edge (natural cave wall).
  if (adj.s) fillRect(ctx, x, y + s * 0.72, s, s * 0.28, c.mid);
  if (adj.n) fillRect(ctx, x, y, s, s * 0.22, shade(c.mid, 10));
  if (adj.e) fillRect(ctx, x + s * 0.75, y, s * 0.25, s, c.lo);
  if (adj.w) fillRect(ctx, x, y, s * 0.22, s, shade(c.hi, -8));

  // Running-bond stone bricks (32×32 pixel layout).
  const bricks = variant === 0
    ? [
        [1, 1, 14, 7, c.base], [16, 1, 15, 7, c.mid],
        [1, 9, 10, 7, c.hi], [12, 9, 19, 7, c.base],
        [1, 17, 15, 7, c.mid], [17, 17, 14, 7, c.lo],
        [1, 25, 12, 6, c.base], [14, 25, 17, 6, c.hi]
      ]
    : variant === 1
    ? [
        [2, 2, 13, 6, c.mid], [16, 2, 14, 6, c.base],
        [1, 9, 18, 8, c.hi], [20, 9, 11, 8, c.base],
        [3, 18, 12, 6, c.base], [16, 18, 15, 6, c.lo],
        [1, 25, 20, 6, c.mid], [22, 25, 9, 6, c.hi]
      ]
    : variant === 2
    ? [
        [1, 1, 30, 5, c.base], [1, 7, 14, 8, c.hi], [16, 7, 15, 8, c.mid],
        [1, 16, 20, 7, c.base], [22, 16, 9, 7, c.lo],
        [1, 24, 11, 7, c.mid], [13, 24, 18, 7, c.hi]
      ]
    : [
        [2, 1, 12, 9, c.base], [15, 1, 15, 9, c.mid],
        [1, 11, 16, 8, c.hi], [18, 11, 13, 8, c.base],
        [2, 20, 14, 5, c.lo], [17, 20, 13, 5, c.mid],
        [1, 26, 30, 5, c.base]
      ];

  p(ctx, x, y, s, bricks);

  // Mortar grooves between bricks.
  p(ctx, x, y, s, [
    [0, 8, 32, 1, c.mortar], [0, 16, 32, 1, c.mortar],
    [15, 0, 1, 9, c.mortar], [10, 9, 1, 8, c.mortar]
  ]);

  // Surface detail: cracks & chips from hash.
  if ((h >> 4) % 7 === 0) {
    p(ctx, x, y, s, [
      [8, 12, 6, 1, c.mortar], [9, 13, 1, 4, c.mortar]
    ]);
  }
  if ((h >> 8) % 5 === 0) {
    p(ctx, x, y, s, [[20, 20, 3, 2, c.dark], [21, 21, 1, 1, shade(c.base, 40)]]);
  }
  if (c.moss && (h >> 6) % 9 === 0) {
    p(ctx, x, y, s, [
      [4, 22, 4, 3, c.moss], [5, 23, 2, 1, shade(c.moss, 25)],
      [24, 6, 3, 2, shade(c.moss, -10)]
    ]);
  }

  // Top-left light (torch from above-left).
  fillRect(ctx, x, y, s, 1, '#ffffff18');
  fillRect(ctx, x, y, 1, s, '#ffffff12');
  fillRect(ctx, x + s - 1, y + s - 1, 1, 1, '#00000055');
}

export function drawFloorTile(ctx, x, y, s, opts = {}) {
  const lit = opts.floorLit || '#2e2734';
  const dim = opts.floorDim || '#181420';
  const base = opts.dim ? dim : lit;
  const tx = opts.tileX ?? 0;
  const ty = opts.tileY ?? 0;
  const h = hash2(tx, ty, 7);

  const grout = shade(base, -22);
  const stoneA = base;
  const stoneB = shade(base, 8);
  const stoneC = shade(base, 14);
  const speck = shade(base, -10);

  fillRect(ctx, x, y, s, s, grout);

  const pattern = h % 5;
  const slabs = pattern === 0
    ? [[3, 2, 12, 11, stoneA], [16, 3, 13, 10, stoneB], [4, 15, 11, 14, stoneC], [17, 16, 12, 13, stoneA]]
    : pattern === 1
    ? [[2, 2, 14, 13, stoneB], [17, 2, 12, 12, stoneA], [3, 17, 26, 12, stoneC]]
    : pattern === 2
    ? [[2, 3, 10, 9, stoneA], [13, 2, 17, 8, stoneB], [2, 12, 8, 17, stoneC], [11, 13, 18, 16, stoneA]]
    : pattern === 3
    ? [[4, 4, 24, 10, stoneB], [3, 16, 11, 13, stoneA], [16, 17, 13, 12, stoneC]]
    : [[5, 2, 9, 13, stoneA], [15, 3, 14, 11, stoneB], [2, 16, 13, 13, stoneC], [16, 15, 14, 14, stoneA]];

  for (const slab of slabs) {
    const [px, py, pw, ph, col] = slab;
    p(ctx, x, y, s, [[px, py, pw, ph, col]]);
    // Bevel per slab.
    const u = s / 32;
    fillRect(ctx, x + px * u, y + py * u, pw * u, 1, '#ffffff14');
    fillRect(ctx, x + px * u, y + py * u, 1, ph * u, '#ffffff0c');
    fillRect(ctx, x + (px + pw - 1) * u, y + (py + ph - 1) * u, 1, 1, '#00000033');
  }

  // Grout gaps & wear.
  if ((h >> 3) % 4 === 0) {
    p(ctx, x, y, s, [[14, 10, 4, 1, grout], [15, 11, 1, 3, grout]]);
  }
  if ((h >> 5) % 6 === 0) {
    fillRect(ctx, x + s * 0.2, y + s * 0.55, 2, 2, speck);
  }
  if ((h >> 7) % 8 === 0 && !opts.dim) {
    fillRect(ctx, x + s * 0.7, y + s * 0.25, 1, 1, '#ffffff22');
  }
}

export function drawVoidTile(ctx, x, y, s, opts = {}) {
  const base = opts.dim ? '#050408' : '#0a0810';
  fillRect(ctx, x, y, s, s, base);
  const h = hash2(opts.tileX ?? 0, opts.tileY ?? 0, 99);
  if ((h % 11) === 0) fillRect(ctx, x + 4, y + 8, 2, 2, '#0e0c14');
}

export function drawStairsDownTile(ctx, x, y, s, opts = {}) {
  const floor = opts.floorLit || '#2e2734';
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const gold = opts.dim ? shade('#d4be7a', -40) : '#d4be7a';
  const u = s / 32;
  for (let i = 0; i < 5; i++) {
    const w = (26 - i * 4) * u;
    const sx = x + (s - w) / 2;
    const sy = y + (6 + i * 5) * u;
    fillRect(ctx, sx, sy, w, 3 * u, i % 2 ? shade(gold, -15) : gold);
    fillRect(ctx, sx, sy, w, 1, '#ffffff28');
  }
  fillRect(ctx, x + s * 0.35, y + s * 0.15, s * 0.3, s * 0.08, '#00000044');
}

export function drawStairsUpTile(ctx, x, y, s, opts = {}) {
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const u = s / 32;
  const col = opts.dim ? '#6a5a40' : '#a09060';
  for (let i = 0; i < 4; i++) {
    const w = (10 + i * 5) * u;
    fillRect(ctx, x + (s - w) / 2, y + (8 + i * 5) * u, w, 3 * u, col);
  }
}

export function drawDoorTile(ctx, x, y, s, opts = {}) {
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const wood = opts.dim ? '#4a3828' : '#7a5436';
  const u = s / 32;
  fillRect(ctx, x + 10 * u, y + 3 * u, 12 * u, 26 * u, wood);
  fillRect(ctx, x + 11 * u, y + 4 * u, 10 * u, 1, shade(wood, 30));
  fillRect(ctx, x + 19 * u, y + 16 * u, 2 * u, 2 * u, '#d4be7a');
  fillRect(ctx, x + 10 * u, y + 3 * u, 1 * u, 26 * u, '#00000055');
}

/** @returns {Record<string, function>} */
export function buildDungeonTileSprites() {
  return {
    tile_wall: (ctx, x, y, s, o) => drawWallTile(ctx, x, y, s, o),
    tile_floor: (ctx, x, y, s, o) => drawFloorTile(ctx, x, y, s, o),
    tile_void: (ctx, x, y, s, o) => drawVoidTile(ctx, x, y, s, o),
    tile_stairs_down: (ctx, x, y, s, o) => drawStairsDownTile(ctx, x, y, s, o),
    tile_stairs_up: (ctx, x, y, s, o) => drawStairsUpTile(ctx, x, y, s, o),
    tile_door: (ctx, x, y, s, o) => drawDoorTile(ctx, x, y, s, o)
  };
}

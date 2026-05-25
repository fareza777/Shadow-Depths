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

function biomeFloorAccent(id, dim) {
  if (dim || !id) return null;
  if (id.includes('garden') || id.includes('bloodroot') || id.includes('veiled')) return '#3a5030';
  if (id.includes('drowning') || id.includes('sunken')) return '#2a5868';
  if (id.includes('frost') || id.includes('salt')) return '#5a7088';
  if (id.includes('ashen') || id.includes('cinder')) return '#6a5040';
  if (id.includes('empty') || id.includes('below')) return '#4a3888';
  return null;
}

function biomeRune(id, dim) {
  if (dim || !id) return '#d4be7a22';
  if (id.includes('drowning') || id.includes('sunken')) return '#58b8c844';
  if (id.includes('frost') || id.includes('salt')) return '#a8d8ff44';
  if (id.includes('ashen') || id.includes('cinder')) return '#d8844a44';
  if (id.includes('empty') || id.includes('below')) return '#b070ff44';
  if (id.includes('garden') || id.includes('bloodroot')) return '#70b85044';
  return '#d4be7a36';
}

/** @param {{ floorLit?:string, floorDim?:string, dim?:boolean, biomeId?:string }} opts */
function floorPalette(opts) {
  const lit = opts.floorLit || '#2e2734';
  const dim = opts.floorDim || '#181420';
  const base = opts.dim ? dim : lit;
  return {
    base,
    hi: shade(base, 14),
    lo: shade(base, -16),
    grout: shade(base, -20),
    wet: shade(base, 22),
    accent: biomeFloorAccent(opts.biomeId, !!opts.dim)
  };
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

  // Light mortar (fewer lines = less busy).
  if (variant % 2 === 0) {
    p(ctx, x, y, s, [[0, 15, 32, 1, c.mortar]]);
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
  const c = floorPalette(opts);
  const tx = opts.tileX ?? 0;
  const ty = opts.tileY ?? 0;
  const h = hash2(tx, ty, 7);
  const block = ((tx >> 1) + (ty >> 1)) & 1;

  const nudge = ((h % 9) - 4) + (block ? 2 : -1);
  fillRect(ctx, x, y, s, s, shade(c.base, nudge));

  if (!opts.dim) {
    const glow = 0.05 + (h % 4) * 0.012;
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + s * 0.22, y + s * 0.24, s * 0.56, s * 0.48);
    ctx.restore();
  }

  if ((h >> 5) % 13 === 0) {
    const px = (h % 20) + 4;
    const py = ((h >> 3) % 18) + 6;
    fillRect(ctx, x + px * (s / 32), y + py * (s / 32), Math.max(1, s * 0.08), 1, c.lo);
  }
  if (c.accent && (h >> 5) % 9 === 0) {
    const ax = (h % 22) + 5;
    const ay = ((h >> 3) % 20) + 6;
    p(ctx, x, y, s, [[ax, ay, 2, 2, c.accent], [ax + 1, ay, 1, 1, shade(c.accent, 30)]]);
  }
  if (!opts.dim && (h >> 8) % 17 === 0) {
    const rune = biomeRune(opts.biomeId, false);
    p(ctx, x, y, s, [
      [14, 10, 4, 1, rune], [15, 11, 2, 1, rune],
      [13, 13, 6, 1, rune], [15, 14, 2, 4, rune],
      [12, 19, 8, 1, rune]
    ]);
  }
  if (!opts.dim && (h >> 9) % 19 === 0) {
    p(ctx, x, y, s, [
      [6, 7, 1, 9, c.lo], [7, 15, 8, 1, c.lo],
      [18, 20, 8, 1, shade(c.lo, 12)], [25, 16, 1, 5, c.lo]
    ]);
  }
  if (!opts.dim && (h >> 11) % 29 === 0) {
    p(ctx, x, y, s, [
      [7, 23, 5, 2, '#5a1820'], [9, 22, 2, 1, '#8a2830'],
      [20, 8, 3, 2, '#5a1820']
    ]);
  }
  const biome = opts.biomeId || '';
  if (!opts.dim && (biome.includes('drowning') || biome.includes('sunken')) && (h >> 6) % 8 === 0) {
    fillRect(ctx, x + 4, y + ((h >> 2) % 16) + 8, s - 8, 1, '#ffffff14');
    fillRect(ctx, x + ((h >> 4) % 12) + 6, y + 10, 3, 1, c.wet);
  }
}

/**
 * Abyss outside rooms — misty cave depth, not flat gray.
 * @param {{ explored?:boolean, tileX?:number, tileY?:number, biomeId?:string }} opts
 */
export function drawVoidTile(ctx, x, y, s, opts = {}) {
  const tx = opts.tileX ?? 0;
  const ty = opts.tileY ?? 0;
  const h = hash2(tx, ty, 99);
  const seen = opts.explored !== false;
  const biome = opts.biomeId || '';

  let abyss = '#06050c';
  let mist = '#14101c';
  let speck = '#2a2438';
  if (biome.includes('drowning') || biome.includes('sunken')) {
    abyss = '#040810'; mist = '#0c1824'; speck = '#1a3040';
  } else if (biome.includes('frost') || biome.includes('salt')) {
    abyss = '#080a14'; mist = '#141a28'; speck = '#283048';
  } else if (biome.includes('ashen') || biome.includes('cinder')) {
    abyss = '#0a0806'; mist = '#1a1410'; speck = '#302820';
  } else if (biome.includes('empty') || biome.includes('below')) {
    abyss = '#020208'; mist = '#0a0820'; speck = '#1a1840';
  }

  if (!seen) {
    fillRect(ctx, x, y, s, s, '#020106');
    ctx.save();
    ctx.globalAlpha = 0.34;
    const g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, '#0a0710');
    g.addColorStop(0.5, '#030208');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    ctx.restore();
    if ((h >> 3) % 6 === 0) {
      fillRect(ctx, x + 3, y + ((h >> 5) % 18) + 6, s - 6, 1, '#ffffff04');
    }
    if ((h >> 7) % 10 === 0) {
      fillRect(ctx, x + ((h >> 2) % 20) + 5, y + ((h >> 6) % 20) + 5, 1, 1, '#d4be7a12');
    }
    if ((h >> 11) % 17 === 0) {
      p(ctx, x, y, s, [
        [6, 24, 7, 4, '#06040a'],
        [8, 22, 3, 2, '#0c0812'],
        [21, 25, 5, 3, '#050309']
      ]);
    }
    fillRect(ctx, x, y, s, 1, '#000000');
    return;
  }

  const depth = ((tx * 0.6 + ty) % 12) / 12;
  fillRect(ctx, x, y, s, s, shade(abyss, Math.floor(depth * 6)));
  ctx.save();
  ctx.globalAlpha = 0.28;
  fillRect(ctx, x, y, s, s * 0.4, mist);
  ctx.restore();

  // Soft vertical depth gradient (farther = darker bottom).
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);

  // Drifting mist wisps.
  if ((h >> 3) % 5 === 0) {
    fillRect(ctx, x + 4, y + s * 0.3, s - 8, 2, '#ffffff06');
  }
  if ((h >> 6) % 7 === 0) {
    fillRect(ctx, x + 2, y + s * 0.6, s * 0.5, 1, '#ffffff08');
  }

  // Distant rock / stalactite silhouette (cave edge feel).
  if ((h >> 4) % 9 === 0) {
    p(ctx, x, y, s, [
      [4, 24, 6, 6, speck], [5, 22, 4, 2, shade(speck, 20)],
      [22, 26, 5, 4, shade(speck, -10)]
    ]);
  }

  // Dust motes in the dark.
  if ((h >> 8) % 11 === 0) {
    fillRect(ctx, x + (h % 20) + 6, y + ((h >> 4) % 18) + 4, 1, 1, '#ffffff18');
  }
  if ((h >> 10) % 13 === 0) {
    fillRect(ctx, x + ((h >> 2) % 22) + 2, y + ((h >> 6) % 20) + 6, 1, 1, '#d4be7a22');
  }

  fillRect(ctx, x, y, 1, s, '#00000033');
  fillRect(ctx, x, y, s, 1, '#00000022');
}

export function drawStairsDownTile(ctx, x, y, s, opts = {}) {
  if (!opts.dim) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    const g = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.08, x + s / 2, y + s / 2, s * 0.58);
    g.addColorStop(0, '#d4be7a66');
    g.addColorStop(0.55, '#d4be7a18');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    ctx.restore();
  }
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const gold = opts.dim ? shade('#d4be7a', -40) : '#d4be7a';
  const u = s / 32;
  for (let i = 0; i < 5; i++) {
    const w = (26 - i * 4) * u;
    const sx = x + (s - w) / 2;
    const sy = y + (6 + i * 5) * u;
    fillRect(ctx, sx, sy, w, 3 * u, i % 2 ? shade(gold, -15) : gold);
    fillRect(ctx, sx, sy, w, 1, '#ffffff28');
    fillRect(ctx, sx + w * 0.42, sy + 1 * u, 2 * u, 1 * u, '#ffffff44');
  }
  fillRect(ctx, x + s * 0.35, y + s * 0.15, s * 0.3, s * 0.08, '#00000044');
  if (!opts.dim) {
    p(ctx, x, y, s, [[14, 4, 4, 3, '#d4be7a'], [15, 5, 2, 1, '#ffffff66']]);
  }
}

export function drawStairsUpTile(ctx, x, y, s, opts = {}) {
  if (!opts.dim) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    const g = ctx.createRadialGradient(x + s / 2, y + s / 2, s * 0.1, x + s / 2, y + s / 2, s * 0.5);
    g.addColorStop(0, '#80b0e066');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    ctx.restore();
  }
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const u = s / 32;
  const col = opts.dim ? '#6a5a40' : '#a09060';
  for (let i = 0; i < 4; i++) {
    const w = (10 + i * 5) * u;
    fillRect(ctx, x + (s - w) / 2, y + (8 + i * 5) * u, w, 3 * u, col);
    fillRect(ctx, x + (s - w) / 2, y + (8 + i * 5) * u, w, 1, '#ffffff22');
  }
}

export function drawDoorTile(ctx, x, y, s, opts = {}) {
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const stone = opts.dim ? '#2a2430' : '#3a3448';
  const wood = opts.dim ? '#4a3828' : '#7a5436';
  const iron = opts.dim ? '#4a4a52' : '#8a9098';
  const u = s / 32;
  p(ctx, x, y, s, [
    [6, 2, 20, 3, stone], [5, 5, 22, 2, shade(stone, 8)],
    [8, 3, 16, 2, shade(stone, 18)], [7, 2, 18, 1, '#ffffff12']
  ]);
  fillRect(ctx, x + 10 * u, y + 6 * u, 12 * u, 23 * u, wood);
  fillRect(ctx, x + 11 * u, y + 7 * u, 10 * u, 1, shade(wood, 30));
  fillRect(ctx, x + 10 * u, y + 14 * u, 1 * u, 10 * u, shade(wood, -25));
  fillRect(ctx, x + 21 * u, y + 14 * u, 1 * u, 10 * u, shade(wood, -25));
  fillRect(ctx, x + 19 * u, y + 18 * u, 2 * u, 2 * u, '#d4be7a');
  fillRect(ctx, x + 19 * u, y + 18 * u, 2 * u, 1, '#ffffff33');
  p(ctx, x, y, s, [
    [9, 8, 2, 20, iron], [21, 8, 2, 20, iron],
    [10, 6, 12, 2, iron]
  ]);
  fillRect(ctx, x + 10 * u, y + 6 * u, 1 * u, 23 * u, '#00000055');
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

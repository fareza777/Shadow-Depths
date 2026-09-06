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
// Void gradients have fixed stops, so build each once at a tile-local origin
// and reuse via translate — the unexplored map is mostly VOID, and allocating
// a CanvasGradient per void tile per frame was the dominant walking-time GC
// churn on low-end phones.
let _voidUnseenG = null, _voidSeenG = null, _voidGradSize = 0;
function _ensureVoidGrads(ctx, s) {
  if (_voidGradSize === s && _voidUnseenG && _voidSeenG) return;
  _voidGradSize = s;
  let g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#0a0710'); g.addColorStop(0.5, '#030208'); g.addColorStop(1, '#000000');
  _voidUnseenG = g;
  g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  _voidSeenG = g;
}

export function drawVoidTile(ctx, x, y, s, opts = {}) {
  const tx = opts.tileX ?? 0;
  const ty = opts.tileY ?? 0;
  const h = hash2(tx, ty, 99);
  const seen = opts.explored !== false;
  const biome = opts.biomeId || '';

  // Lean fast-path: the unexplored map is the bulk of the screen and reads as
  // flat darkness anyway, so on low-end devices skip the gradient + specks and
  // lay down a single flat fill (big per-frame draw-call saving while walking).
  if (!seen && opts.lean) {
    fillRect(ctx, x, y, s, s, '#040209');
    fillRect(ctx, x, y, s, 1, '#000000');
    return;
  }

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
    ctx.translate(x, y);
    _ensureVoidGrads(ctx, s);
    ctx.fillStyle = _voidUnseenG;
    ctx.fillRect(0, 0, s, s);
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
  ctx.save();
  ctx.translate(x, y);
  _ensureVoidGrads(ctx, s);
  ctx.fillStyle = _voidSeenG;
  ctx.fillRect(0, 0, s, s);
  ctx.restore();

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
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const dim = !!opts.dim;
  const u = s / 32;
  const stoneHi = dim ? '#4a4554' : '#6e6678';
  const stone = dim ? '#3a3542' : '#524c5c';
  const stoneLo = dim ? '#2a2630' : '#3c3844';
  const pit = dim ? '#06050a' : '#0c0a12';
  const pitDeep = '#000000';
  const brass = dim ? '#6a5a38' : '#d4be7a';

  // Stone curbs flanking the stairwell.
  p(ctx, x, y, s, [
    [1, 6, 6, 24, stoneLo],
    [25, 6, 6, 24, stoneLo],
    [2, 7, 4, 22, stone],
    [26, 7, 4, 22, stone]
  ]);

  // Descending treads (narrow toward the pit).
  const treads = [
    { y: 6, w: 22, h: 4 },
    { y: 12, w: 18, h: 4 },
    { y: 18, w: 14, h: 4 },
    { y: 24, w: 11, h: 3 }
  ];
  for (let i = 0; i < treads.length; i++) {
    const t = treads[i];
    const tw = t.w * u;
    const th = t.h * u;
    const sx = x + (s - tw) / 2;
    const sy = y + t.y * u;
    fillRect(ctx, sx, sy, tw, th, i % 2 === 0 ? stoneHi : stone);
    fillRect(ctx, sx, sy, tw, 1, '#ffffff22');
    fillRect(ctx, sx, sy + th - 1, tw, 1, '#00000066');
    fillRect(ctx, sx, sy + th, tw, Math.max(1, u), stoneLo);
  }

  // Pit opening.
  const pitX = x + s * 0.26;
  const pitY = y + s * 0.52;
  const pitW = s * 0.48;
  const pitH = s * 0.42;
  fillRect(ctx, pitX, pitY, pitW, pitH, pit);
  fillRect(ctx, pitX + 2 * u, pitY + 2 * u, pitW - 4 * u, pitH - 3 * u, pitDeep);
  fillRect(ctx, pitX, pitY, pitW, 1, '#000000aa');

  if (!dim) {
    ctx.save();
    ctx.globalAlpha = 0.38;
    const g = ctx.createRadialGradient(
      x + s / 2, y + s * 0.78, u,
      x + s / 2, y + s * 0.78, s * 0.42
    );
    g.addColorStop(0, '#d4be7a55');
    g.addColorStop(0.55, '#d4be7a14');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    ctx.restore();
    // Descend hint (brass chevron).
    p(ctx, x, y, s, [
      [15, 4, 2, 2, brass],
      [14, 6, 4, 1, brass],
      [13, 8, 6, 1, shade(brass, -18)],
      [15, 5, 2, 1, '#ffffff55']
    ]);
  }
}

export function drawStairsUpTile(ctx, x, y, s, opts = {}) {
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const dim = !!opts.dim;
  const u = s / 32;
  const stoneHi = dim ? '#4a4554' : '#6e6678';
  const stone = dim ? '#3a3542' : '#524c5c';
  const stoneLo = dim ? '#2a2630' : '#3c3844';
  const sky = dim ? '#3a4860' : '#8ab0d8';
  const skyHi = dim ? '#4a5870' : '#b8d4f0';

  // Back wall / light from above.
  fillRect(ctx, x + 4 * u, y + 2 * u, s - 8 * u, 7 * u, dim ? '#2a2834' : '#3a3848');
  if (!dim) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    const g = ctx.createLinearGradient(x, y, x, y + s * 0.35);
    g.addColorStop(0, '#a8c8f044');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s * 0.4);
    ctx.restore();
  }

  p(ctx, x, y, s, [
    [1, 8, 5, 22, stoneLo],
    [26, 8, 5, 22, stoneLo]
  ]);

  // Ascending treads (wider toward the top).
  const treads = [
    { y: 24, w: 12, h: 3 },
    { y: 19, w: 15, h: 4 },
    { y: 14, w: 18, h: 4 },
    { y: 9, w: 21, h: 4 }
  ];
  for (let i = 0; i < treads.length; i++) {
    const t = treads[i];
    const tw = t.w * u;
    const th = t.h * u;
    const sx = x + (s - tw) / 2;
    const sy = y + t.y * u;
    fillRect(ctx, sx, sy, tw, th, i % 2 === 0 ? stoneHi : stone);
    fillRect(ctx, sx, sy, tw, 1, '#ffffff24');
    fillRect(ctx, sx, sy + th - 1, tw, 1, '#00000055');
  }

  // Ladder rails + rungs.
  const railX1 = x + 11 * u;
  const railX2 = x + 19 * u;
  fillRect(ctx, railX1, y + 8 * u, 2 * u, 20 * u, dim ? '#5a5040' : '#8a7858');
  fillRect(ctx, railX2, y + 8 * u, 2 * u, 20 * u, dim ? '#5a5040' : '#8a7858');
  for (let r = 0; r < 4; r++) {
    const ry = y + (10 + r * 5) * u;
    fillRect(ctx, railX1, ry, railX2 - railX1 + 2 * u, 1.5 * u, dim ? '#6a6050' : '#c4a86a');
    fillRect(ctx, railX1, ry, railX2 - railX1 + 2 * u, 1, '#ffffff28');
  }

  if (!dim) {
    p(ctx, x, y, s, [
      [14, 26, 4, 2, sky],
      [15, 27, 2, 1, skyHi]
    ]);
  }
}

/** Open secret passage (walkable) — not a closed door. */
export function drawDoorTile(ctx, x, y, s, opts = {}) {
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const dim = !!opts.dim;
  const u = s / 32;
  const stone = dim ? '#3a3448' : '#524c5c';
  const stoneHi = dim ? '#4a4554' : '#6e6678';
  const voidCol = dim ? '#0a0810' : '#120e18';
  const brass = dim ? '#8a7048' : '#d4be7a';

  // Collapsed wall rubble on the sides.
  p(ctx, x, y, s, [
    [2, 4, 7, 24, stone], [23, 4, 7, 24, stone],
    [3, 3, 6, 3, stoneHi], [23, 3, 6, 3, stoneHi]
  ]);

  // Dark opening you can walk through.
  fillRect(ctx, x + 9 * u, y + 5 * u, 14 * u, 24 * u, voidCol);
  fillRect(ctx, x + 10 * u, y + 6 * u, 12 * u, 22 * u, '#000000');

  // Brass arch at the top (matches stairs-down accent).
  p(ctx, x, y, s, [
    [10, 4, 12, 2, brass],
    [11, 6, 10, 1, shade(brass, -20)],
    [15, 5, 2, 1, '#ffffff44']
  ]);

  if (!dim) {
    fillRect(ctx, x + 12 * u, y + 14 * u, 1 * u, 1 * u, '#d4be7a88');
    fillRect(ctx, x + 19 * u, y + 20 * u, 1 * u, 1 * u, '#d4be7a66');
  }
}

/**
 * A vault door still waiting on its key: the same jamb as an open doorway,
 * but the gap is banded iron with a brass lockplate instead of darkness, so
 * "sealed" reads at a glance without a legend.
 */
export function drawLockedDoorTile(ctx, x, y, s, opts = {}) {
  drawFloorTile(ctx, x, y, s, { ...opts, dim: opts.dim });
  const dim = !!opts.dim;
  const u = s / 32;
  const stone = dim ? '#3a3448' : '#524c5c';
  const stoneHi = dim ? '#4a4554' : '#6e6678';
  const iron = dim ? '#2e2a34' : '#45404e';
  const ironHi = dim ? '#3c3744' : '#5b5566';
  const brass = dim ? '#8a7048' : '#d4be7a';

  // Same jamb as the open door so the two read as one family.
  p(ctx, x, y, s, [
    [2, 4, 7, 24, stone], [23, 4, 7, 24, stone],
    [3, 3, 6, 3, stoneHi], [23, 3, 6, 3, stoneHi]
  ]);

  // Slab filling the opening, with plank banding.
  fillRect(ctx, x + 9 * u, y + 5 * u, 14 * u, 24 * u, iron);
  p(ctx, x, y, s, [
    [9, 10, 14, 1, ironHi],
    [9, 18, 14, 1, ironHi],
    [9, 25, 14, 1, ironHi]
  ]);

  // Brass arch, lockplate and keyhole.
  p(ctx, x, y, s, [
    [10, 4, 12, 2, brass],
    [14, 15, 4, 5, brass],
    [15, 16, 2, 2, dim ? '#1a1620' : '#120e18'],
    [15, 18, 2, 2, dim ? '#1a1620' : '#120e18']
  ]);
  if (!dim) fillRect(ctx, x + 15 * u, y + 15 * u, 1 * u, 1 * u, '#ffffff55');
}

/** @returns {Record<string, function>} */
export function buildDungeonTileSprites() {
  return {
    tile_wall: (ctx, x, y, s, o) => drawWallTile(ctx, x, y, s, o),
    tile_floor: (ctx, x, y, s, o) => drawFloorTile(ctx, x, y, s, o),
    tile_void: (ctx, x, y, s, o) => drawVoidTile(ctx, x, y, s, o),
    tile_stairs_down: (ctx, x, y, s, o) => drawStairsDownTile(ctx, x, y, s, o),
    tile_stairs_up: (ctx, x, y, s, o) => drawStairsUpTile(ctx, x, y, s, o),
    tile_door: (ctx, x, y, s, o) => drawDoorTile(ctx, x, y, s, o),
    tile_door_locked: (ctx, x, y, s, o) => drawLockedDoorTile(ctx, x, y, s, o)
  };
}

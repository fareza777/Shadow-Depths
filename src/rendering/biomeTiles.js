/**
 * Biome tile atlas — canvas port of biome-tiles.jsx.
 *
 * 10 biomes, each with a wall + floor renderer. Patterns are deterministic
 * on (tileX, tileY) so tiles never flicker between frames and adjacent
 * tiles look distinct via a 5-bucket hash.
 *
 * Public API:
 *   drawBiomeWall(ctx, ox, oy, size, tileX, tileY, biomeId)
 *   drawBiomeFloor(ctx, ox, oy, size, tileX, tileY, biomeId)
 *   getBiomePalette(biomeId)
 *   biomeIdForFloor(floorIndex)   // 10 floors per biome
 *
 * Coordinate convention: each biome draws into a virtual 32×32 grid, then
 * helpers scale by `s = size / 32` so any TILE_SIZE works.
 */

// ─── Deterministic per-tile hash (mirrors JSX sdHash) ───────────────────
function sdHash(x, y, salt = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + salt * 43.5) * 43758.5453;
  return Math.abs(n - Math.floor(n));
}
function sdVariant(x, y, n, salt = 0) { return Math.floor(sdHash(x, y, salt) * n); }
function sdRoll(x, y, threshold, salt = 0) { return sdHash(x, y, salt) < threshold; }

// ─── Drawing helpers (all SVG primitives → canvas) ──────────────────────
function R(ctx, ox, oy, s, x, y, w, h, color, alpha) {
  if (alpha != null && alpha < 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * s, oy + y * s, w * s, h * s);
    ctx.restore();
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * s, oy + y * s, w * s, h * s);
  }
}
function C(ctx, ox, oy, s, cx, cy, r, color, alpha) {
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(ox + cx * s, oy + cy * s, r * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function E(ctx, ox, oy, s, cx, cy, rx, ry, color, alpha) {
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(ox + cx * s, oy + cy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function L(ctx, ox, oy, s, x1, y1, x2, y2, color, w, alpha) {
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w * s;
  ctx.beginPath();
  ctx.moveTo(ox + x1 * s, oy + y1 * s);
  ctx.lineTo(ox + x2 * s, oy + y2 * s);
  ctx.stroke();
  ctx.restore();
}
function STROKE(ctx, ox, oy, s, color, w, alpha, build) {
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w * s;
  ctx.beginPath();
  build(ctx, (px, py) => ctx.moveTo(ox + px * s, oy + py * s),
              (px, py) => ctx.lineTo(ox + px * s, oy + py * s),
              (cpx, cpy, px, py) => ctx.quadraticCurveTo(ox + cpx * s, oy + cpy * s, ox + px * s, oy + py * s));
  ctx.stroke();
  ctx.restore();
}
function POLY(ctx, ox, oy, s, color, alpha, pts) {
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) ctx.moveTo(ox + pts[i] * s, oy + pts[i + 1] * s);
    else ctx.lineTo(ox + pts[i] * s, oy + pts[i + 1] * s);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function POLY_STROKE(ctx, ox, oy, s, color, w, alpha, pts) {
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w * s;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) ctx.moveTo(ox + pts[i] * s, oy + pts[i + 1] * s);
    else ctx.lineTo(ox + pts[i] * s, oy + pts[i + 1] * s);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
function GRAD_V(ctx, ox, oy, size, colors) {
  const g = ctx.createLinearGradient(ox, oy, ox, oy + size);
  for (let i = 0; i < colors.length; i++) g.addColorStop(i / (colors.length - 1), colors[i]);
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, size, size);
}
// ═══════════════════════════════════════════════════════════════════════
// BIOMES
// ═══════════════════════════════════════════════════════════════════════

// ───────── 1 · FORGOTTEN CRYPTS ────────────────────────────────────────
const forgotten_crypts = {
  palette: { bg:'#1a161e', ambient:'#4a7eb8', torchTint:'#b8935a',
             wallCap:'#9a8c98', wallCapOpacity:0.55, grain:'#08070c', dust:'#7a6e80' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const cr = sdVariant(x, y, 5);
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#403a48');
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#000', sdHash(x, y, 7) * 0.18);
    // mortar grid (offset rows)
    R(ctx, ox, oy, s, 0, 0, 32, 1.5, '#08070c');
    R(ctx, ox, oy, s, 0, 14.5, 32, 1.5, '#08070c');
    R(ctx, ox, oy, s, y % 2 === 0 ? 14.5 : -1.5, 1.5, 1.5, 13, '#08070c');
    R(ctx, ox, oy, s, y % 2 === 0 ? -1.5 : 14.5, 16, 1.5, 14.5, '#08070c');
    // edge highlights
    R(ctx, ox, oy, s, 1.5, 1.5, 13, 0.7, '#7a6e80', 0.7);
    R(ctx, ox, oy, s, 1.5, 16, 13, 0.7, '#7a6e80', 0.7);
    // chips / cracks
    if (cr === 0) STROKE(ctx, ox, oy, s, '#08070c', 0.6, null, (_c, m, l) => { m(5,6); l(7,9); l(10,7); });
    if (cr === 1) R(ctx, ox, oy, s, 20, 22, 2, 2, '#08070c');
    if (cr === 2) C(ctx, ox, oy, s, 24, 6, 0.8, '#5a5240', 0.5);
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#1a161e','#1e1a22','#221e26','#1c181f','#241f28'][v];
    const d = sdVariant(x, y, 12, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.5, '#08070c', 0.7);
    R(ctx, ox, oy, s, 0, 0, 0.5, 32, '#08070c', 0.7);
    R(ctx, ox, oy, s, 1, 1, 11, 0.3, '#3a3340', 0.2);
    if (d === 0) C(ctx, ox, oy, s, 16, 16, 1.2, '#5a5240', 0.4);
    if (d === 1) L(ctx, ox, oy, s, 20, 8, 22, 12, '#08070c', 0.4, 0.5);
    if (d === 2) R(ctx, ox, oy, s, 8, 22, 1, 1, '#08070c');
  }
};

// ───────── 2 · BONE GARDEN ─────────────────────────────────────────────
const bone_garden = {
  palette: { bg:'#1a1410', ambient:'#c4503a', torchTint:'#d4ac6c',
             wallCap:'#9a7e5a', wallCapOpacity:0.55, grain:'#1a0808', dust:'#7a5a3a' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 6);
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#5a4838');
    R(ctx, ox, oy, s, 0, 0, 32, 1, '#1a0808');
    R(ctx, ox, oy, s, 0, 15, 32, 1, '#1a0808');
    R(ctx, ox, oy, s, y % 2 === 0 ? 15 : -1, 1, 1, 14, '#1a0808');
    R(ctx, ox, oy, s, y % 2 === 0 ? -1 : 15, 16, 1, 15, '#1a0808');
    R(ctx, ox, oy, s, 1, 1, 13, 0.5, '#9a7e5a', 0.6);
    R(ctx, ox, oy, s, 1, 16, 13, 0.5, '#9a7e5a', 0.6);
    // blood vein
    STROKE(ctx, ox, oy, s, '#5a1010', 0.6, 0.6, (_c, m, l, q) => {
      m(2, 6); q(8, 4, 13, 8); l(13, 14);
    });
    if (v === 0) {
      E(ctx, ox, oy, s, 22, 22, 3.5, 1, '#e0d4a8', 0.7);
      C(ctx, ox, oy, s, 19, 22, 0.6, '#1a0808');
      C(ctx, ox, oy, s, 25, 22, 0.6, '#1a0808');
    }
    if (v === 1) C(ctx, ox, oy, s, 6, 22, 1.2, '#1a0808');
    if (v === 2) STROKE(ctx, ox, oy, s, '#1a0808', 0.5, null, (_c, m, l) => { m(22,5); l(25,8); l(23,12); });
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#1f1812','#241c14','#1a1410','#2a2018','#181410'][v];
    const d = sdVariant(x, y, 16, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.5, '#0a0404', 0.7);
    R(ctx, ox, oy, s, 0, 0, 0.5, 32, '#0a0404', 0.7);
    if (d === 0) {
      C(ctx, ox, oy, s, 14, 16, 1.8, '#3a0808', 0.7);
      C(ctx, ox, oy, s, 17, 14, 0.7, '#3a0808', 0.7);
      C(ctx, ox, oy, s, 12, 19, 0.5, '#3a0808', 0.7);
    }
    if (d === 1) {
      R(ctx, ox, oy, s, 10, 18, 6, 1.5, '#9a8e6c', 0.5);
      C(ctx, ox, oy, s, 10, 18.7, 0.7, '#9a8e6c', 0.5);
      C(ctx, ox, oy, s, 16, 18.7, 0.7, '#9a8e6c', 0.5);
    }
    if (d === 2) C(ctx, ox, oy, s, 22, 10, 0.6, '#3a0808', 0.8);
  }
};

// ───────── 3 · FROZEN HALLS ────────────────────────────────────────────
const frozen_halls = {
  palette: { bg:'#0c1018', ambient:'#7faafa', torchTint:'#bfd6ff',
             wallCap:'#bfd6ff', wallCapOpacity:0.55, grain:'#0a0e16', dust:'#7faafa' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 6);
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#2a3a4a');
    R(ctx, ox, oy, s, 0, 0, 32, 1, '#0c1018');
    R(ctx, ox, oy, s, 0, 15, 32, 1, '#0c1018');
    R(ctx, ox, oy, s, y % 2 === 0 ? 15 : -1, 1, 1, 14, '#0c1018');
    R(ctx, ox, oy, s, y % 2 === 0 ? -1 : 15, 16, 1, 15, '#0c1018');
    // frost coating
    R(ctx, ox, oy, s, 1, 1, 14, 2, '#bfd6ff', 0.35);
    R(ctx, ox, oy, s, 16, 16, 15, 1.5, '#bfd6ff', 0.30);
    // crack
    STROKE(ctx, ox, oy, s, '#7faafa', 0.4, 0.7, (_c, m, l) => { m(4,7); l(8,5); l(10,9); l(14,7); });
    if (v === 0) STROKE(ctx, ox, oy, s, '#bfd6ff', 0.5, 0.8, (_c, m, l) => { m(2,16); l(4,20); l(3,24); l(6,28); });
    if (v === 1) POLY(ctx, ox, oy, s, '#bfd6ff', 0.7, [22,1, 23,1, 22.5,5]);
    if (v === 2) C(ctx, ox, oy, s, 24, 22, 1, '#bfd6ff', 0.5);
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#1a2638','#1e2c40','#22324a','#1a2840','#243a52'][v];
    const d = sdVariant(x, y, 14, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.5, '#0a0e16', 0.7);
    R(ctx, ox, oy, s, 0, 0, 0.5, 32, '#0a0e16', 0.7);
    R(ctx, ox, oy, s, 2, 2, 10, 0.6, '#bfd6ff', 0.25);
    R(ctx, ox, oy, s, 2, 3.5, 6, 0.4, '#bfd6ff', 0.15);
    if (d === 0) {
      // snowflake
      L(ctx, ox, oy, s, 16, 13, 16, 19, '#bfd6ff', 0.4, 0.7);
      L(ctx, ox, oy, s, 13, 16, 19, 16, '#bfd6ff', 0.4, 0.7);
      L(ctx, ox, oy, s, 13.7, 13.7, 18.3, 18.3, '#bfd6ff', 0.4, 0.7);
      L(ctx, ox, oy, s, 18.3, 13.7, 13.7, 18.3, '#bfd6ff', 0.4, 0.7);
    }
    if (d === 1) {
      E(ctx, ox, oy, s, 20, 22, 6, 2.5, '#7faafa', 0.4);
      E(ctx, ox, oy, s, 18, 21, 2, 0.7, '#bfd6ff', 0.6);
    }
    if (d === 2) {
      E(ctx, ox, oy, s, 10, 16, 1.2, 2, '#0a0e16', 0.4);
      E(ctx, ox, oy, s, 10, 13, 0.5, 0.5, '#0a0e16', 0.4);
    }
    if (d === 3) C(ctx, ox, oy, s, 22, 10, 0.4, '#bfd6ff', 0.6);
  }
};

// ───────── 4 · SUNKEN FOREST ───────────────────────────────────────────
const sunken_forest = {
  palette: { bg:'#0c1408', ambient:'#88c656', torchTint:'#c4ff7f',
             wallCap:'#88c656', wallCapOpacity:0.55, grain:'#08100a', dust:'#88c656' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 6);
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#3a4828');
    R(ctx, ox, oy, s, 0, 0, 32, 1.2, '#08100a');
    R(ctx, ox, oy, s, 0, 15, 32, 1.2, '#08100a');
    R(ctx, ox, oy, s, y % 2 === 0 ? 15 : -1, 1.2, 1.2, 13.8, '#08100a');
    R(ctx, ox, oy, s, y % 2 === 0 ? -1 : 15, 16.2, 1.2, 14.8, '#08100a');
    R(ctx, ox, oy, s, 1.2, 1.2, 13, 0.6, '#6a8848', 0.7);
    if (v === 0) {
      E(ctx, ox, oy, s, 6, 6, 3, 1.5, '#5a7838', 0.85);
      E(ctx, ox, oy, s, 5, 5.5, 1.2, 0.6, '#88c656', 0.85);
      C(ctx, ox, oy, s, 3, 7, 0.6, '#5a7838', 0.85);
    }
    if (v === 1) {
      E(ctx, ox, oy, s, 22, 20, 4, 2, '#5a7838', 0.85);
      C(ctx, ox, oy, s, 24, 19, 0.8, '#88c656', 0.85);
      C(ctx, ox, oy, s, 20, 21, 0.5, '#88c656', 0.85);
    }
    if (v === 2) {
      R(ctx, ox, oy, s, 10, 22, 1, 3, '#d8cba0');
      E(ctx, ox, oy, s, 10.5, 22, 2, 1.2, '#88c656', 0.9);
      C(ctx, ox, oy, s, 10.5, 21.5, 0.4, '#c4ff7f');
    }
    if (v === 3) STROKE(ctx, ox, oy, s, '#4a6028', 0.6, 0.8, (_c, m, l, q) => {
      m(24, 1); q(23, 8, 24, 14); q(25, 18, 23, 22);
    });
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#1a2010','#1f2614','#1c2210','#221a14','#1a2412'][v];
    const d = sdVariant(x, y, 12, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.5, '#080a04', 0.7);
    R(ctx, ox, oy, s, 0, 0, 0.5, 32, '#080a04', 0.7);
    if (d === 0) {
      // leaf (no rotation to keep simple)
      E(ctx, ox, oy, s, 16, 16, 3, 1.5, '#5a4828', 0.7);
      L(ctx, ox, oy, s, 13, 16, 19, 16, '#3a2818', 0.3, 1);
    }
    if (d === 1) {
      L(ctx, ox, oy, s, 20, 22, 20, 18, '#5a7838', 0.5, 0.8);
      L(ctx, ox, oy, s, 21, 22, 22, 19, '#5a7838', 0.5, 0.8);
      L(ctx, ox, oy, s, 19, 22, 18, 19, '#5a7838', 0.5, 0.8);
    }
    if (d === 2) {
      E(ctx, ox, oy, s, 10, 20, 0.8, 0.5, '#88c656', 0.9);
      R(ctx, ox, oy, s, 9.7, 20, 0.6, 1.5, '#d8cba0', 0.7);
    }
    if (d === 3) C(ctx, ox, oy, s, 24, 10, 0.4, '#3a4828', 0.7);
  }
};

// ───────── 5 · IRON STRONGHOLD ─────────────────────────────────────────
const iron_stronghold = {
  palette: { bg:'#1a1620', ambient:'#ff8844', torchTint:'#ffd4a8',
             wallCap:'#9a8e9a', wallCapOpacity:0.55, grain:'#08060c', dust:'#6a5e6a' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 4);
    GRAD_V(ctx, ox, oy, size, ['#4a3c44', '#1a1218']);
    // plate seam
    R(ctx, ox, oy, s, 0, 0, 32, 2, '#08060c');
    R(ctx, ox, oy, s, 0, 30, 32, 2, '#08060c');
    R(ctx, ox, oy, s, 0, 0, 2, 32, '#08060c');
    R(ctx, ox, oy, s, 30, 0, 2, 32, '#08060c');
    R(ctx, ox, oy, s, 2, 2, 28, 0.6, '#6a5e6a', 0.7);
    R(ctx, ox, oy, s, 2, 2, 0.6, 28, '#6a5e6a', 0.4);
    // hammered marks
    C(ctx, ox, oy, s, 10, 10, 1.5, '#5a4c54', 0.4);
    C(ctx, ox, oy, s, 22, 22, 1.2, '#5a4c54', 0.4);
    C(ctx, ox, oy, s, 20, 8, 0.8, '#0a080c', 0.5);
    // rivets at corners (dark base + lighter dot)
    for (const [cx, cy] of [[5,5],[27,5],[5,27],[27,27]]) {
      C(ctx, ox, oy, s, cx, cy, 2, '#08060c');
      C(ctx, ox, oy, s, cx, cy, 1.5, '#5a4c54');
      C(ctx, ox, oy, s, cx - 0.3, cy - 0.3, 0.4, '#9a8e9a');
    }
    if (v === 0) R(ctx, ox, oy, s, 14, 2, 4, 0.5, '#b8935a', 0.8);
    if (v === 1) C(ctx, ox, oy, s, 16, 16, 1.2, '#b8935a', 0.4);
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#1c1820','#221c26','#181420','#1f1a22','#1a1620'][v];
    const d = sdVariant(x, y, 10, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 1, '#08060c');
    R(ctx, ox, oy, s, 0, 0, 1, 32, '#08060c');
    R(ctx, ox, oy, s, 1, 1, 14, 0.5, '#3a3240', 0.5);
    // small corner rivet
    C(ctx, ox, oy, s, 3, 3, 1, '#5a4c54');
    C(ctx, ox, oy, s, 3, 3, 0.4, '#9a8e9a');
    if (d === 0) {
      C(ctx, ox, oy, s, 16, 16, 3, '#08060c');
      ctx.save();
      ctx.strokeStyle = '#3a3240';
      ctx.lineWidth = 0.4 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 16 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (d === 1) R(ctx, ox, oy, s, 14, 22, 6, 0.6, '#08060c', 0.8);
    if (d === 2) C(ctx, ox, oy, s, 22, 10, 0.6, '#b8935a', 0.5);
  }
};

// ───────── 6 · SUN-CURSED SANDS ────────────────────────────────────────
const sun_cursed_sands = {
  palette: { bg:'#1c140a', ambient:'#ffaa44', torchTint:'#ffe488',
             wallCap:'#d4ac6c', wallCapOpacity:0.55, grain:'#1a0e04', dust:'#a07840' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 6);
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#7a5828');
    R(ctx, ox, oy, s, 0, 0, 32, 1.5, '#2a1808');
    R(ctx, ox, oy, s, 0, 30.5, 32, 1.5, '#2a1808');
    R(ctx, ox, oy, s, 0, 0, 1.5, 32, '#2a1808');
    R(ctx, ox, oy, s, 30.5, 0, 1.5, 32, '#2a1808');
    R(ctx, ox, oy, s, 1.5, 1.5, 29, 1, '#a07840', 0.5);
    R(ctx, ox, oy, s, 1.5, 1.5, 1, 29, '#a07840', 0.4);
    if (v === 0) {
      // hieroglyph: eye
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#2a1808';
      ctx.lineWidth = 0.6 * s;
      ctx.beginPath();
      ctx.ellipse(ox + 16 * s, oy + 16 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      C(ctx, ox, oy, s, 16, 16, 1.5, '#2a1808', 0.7);
      L(ctx, ox, oy, s, 10, 13, 8, 11, '#2a1808', 0.6, 0.75);
    }
    if (v === 1) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#2a1808';
      ctx.lineWidth = 0.7 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 10 * s, 3 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      L(ctx, ox, oy, s, 16, 13, 16, 22, '#2a1808', 0.7, 0.75);
      L(ctx, ox, oy, s, 12, 16, 20, 16, '#2a1808', 0.7, 0.75);
    }
    if (v === 2) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#2a1808';
      ctx.lineWidth = 0.6 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 16 * s, 4 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      C(ctx, ox, oy, s, 16, 16, 1.5, '#2a1808', 0.7);
      for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) {
        const r = a * Math.PI / 180;
        L(ctx, ox, oy, s,
          16 + 5 * Math.cos(r), 16 + 5 * Math.sin(r),
          16 + 7 * Math.cos(r), 16 + 7 * Math.sin(r),
          '#2a1808', 0.5, 0.7);
      }
    }
    if (v === 3) STROKE(ctx, ox, oy, s, '#a07840', 0, 0.6, () => {});
    if (v === 3) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#a07840';
      ctx.beginPath();
      ctx.moveTo(ox + 2 * s, oy + 28 * s);
      ctx.quadraticCurveTo(ox + 10 * s, oy + 26 * s, ox + 16 * s, oy + 28 * s);
      ctx.quadraticCurveTo(ox + 22 * s, oy + 30 * s, ox + 30 * s, oy + 28 * s);
      ctx.lineTo(ox + 30 * s, oy + 32 * s);
      ctx.lineTo(ox + 2 * s, oy + 32 * s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#3a2a14','#42301a','#382812','#4a341a','#3e2c16'][v];
    const d = sdVariant(x, y, 14, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.5, '#1a0e04', 0.6);
    R(ctx, ox, oy, s, 0, 0, 0.5, 32, '#1a0e04', 0.6);
    // sand ripples (quadratic curves)
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#a07840';
    ctx.lineWidth = 0.4 * s;
    ctx.beginPath();
    ctx.moveTo(ox + 2 * s, oy + 8 * s);
    ctx.quadraticCurveTo(ox + 10 * s, oy + 6 * s, ox + 18 * s, oy + 8 * s);
    ctx.quadraticCurveTo(ox + 26 * s, oy + 10 * s, ox + 30 * s, oy + 8 * s);
    ctx.moveTo(ox + 2 * s, oy + 22 * s);
    ctx.quadraticCurveTo(ox + 12 * s, oy + 20 * s, ox + 22 * s, oy + 22 * s);
    ctx.stroke();
    ctx.restore();
    if (d === 0) {
      E(ctx, ox, oy, s, 16, 20, 3, 1.5, '#a07840', 0.6);
      C(ctx, ox, oy, s, 14, 20, 0.5, '#1a0e04');
      C(ctx, ox, oy, s, 18, 20, 0.5, '#1a0e04');
    }
    if (d === 1) E(ctx, ox, oy, s, 20, 14, 1.2, 2, '#1a0e04', 0.5);
    if (d === 2) C(ctx, ox, oy, s, 8, 22, 0.6, '#a07840', 0.6);
    if (d === 3) {
      L(ctx, ox, oy, s, 22, 6, 26, 10, '#a07840', 0.3, 0.5);
      L(ctx, ox, oy, s, 24, 6, 22, 8, '#a07840', 0.3, 0.5);
    }
  }
};

// ───────── 7 · MIRROR VAULTS ───────────────────────────────────────────
const mirror_vaults = {
  palette: { bg:'#08060c', ambient:'#d4ac6c', torchTint:'#fff2c0',
             wallCap:'#d4ac6c', wallCapOpacity:0.55, grain:'#08070c', dust:'#d4ac6c' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 4);
    // diagonal marble gradient
    const g = ctx.createLinearGradient(ox, oy, ox + size, oy + size);
    g.addColorStop(0, '#2a2236');
    g.addColorStop(0.5, '#15101e');
    g.addColorStop(1, '#2a2236');
    ctx.fillStyle = g;
    ctx.fillRect(ox, oy, size, size);
    // marble veins
    STROKE(ctx, ox, oy, s, '#7a6c84', 0.5, 0.85, (_c, m, l, q) => {
      m(2, 6); q(10, 8, 14, 14); q(18, 20, 28, 22);
    });
    STROKE(ctx, ox, oy, s, '#3a3340', 0.3, 0.5, (_c, m, l, q) => {
      m(6, 30); q(12, 24, 16, 26); q(22, 28, 30, 24);
    });
    // gold inlay borders
    R(ctx, ox, oy, s, 0, 0, 32, 0.6, '#b8935a', 0.8);
    R(ctx, ox, oy, s, 0, 31.4, 32, 0.6, '#b8935a', 0.8);
    if (v === 0) {
      POLY_STROKE(ctx, ox, oy, s, '#b8935a', 0.6, 0.9, [16,10, 22,16, 16,22, 10,16]);
      C(ctx, ox, oy, s, 16, 16, 1, '#d4ac6c');
    }
    if (v === 1) {
      L(ctx, ox, oy, s, 6, 6, 26, 26, '#b8935a', 0.5, 0.85);
      L(ctx, ox, oy, s, 26, 6, 6, 26, '#b8935a', 0.5, 0.85);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#b8935a';
      ctx.lineWidth = 0.5 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 16 * s, 2 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (v === 2) {
      POLY_STROKE(ctx, ox, oy, s, '#b8935a', 0.5, 0.8, [13,13, 19,13, 19,19, 13,19]);
      R(ctx, ox, oy, s, 15, 15, 2, 2, '#d4ac6c', 0.7);
    }
    R(ctx, ox, oy, s, 1, 1, 30, 3, '#fff', 0.04);
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#0e0a14','#120e18','#0a0810','#16101c','#0e0a16'][v];
    const d = sdVariant(x, y, 14, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.5, '#b8935a', 0.45);
    R(ctx, ox, oy, s, 0, 0, 0.5, 32, '#b8935a', 0.45);
    R(ctx, ox, oy, s, 1, 1, 11, 2, '#fff', 0.04);
    if (d === 0) {
      POLY(ctx, ox, oy, s, '#b8935a', 0.8, [16,12, 19,16, 16,20, 13,16]);
      POLY(ctx, ox, oy, s, '#fff2c0', 0.6, [16,14, 17.5,16, 16,18, 14.5,16]);
    }
    if (d === 1) {
      L(ctx, ox, oy, s, 16, 10, 16, 22, '#b8935a', 0.5, 0.7);
      L(ctx, ox, oy, s, 10, 16, 22, 16, '#b8935a', 0.5, 0.7);
    }
    if (d === 2) C(ctx, ox, oy, s, 16, 16, 0.6, '#fff2c0', 0.7);
  }
};

// ───────── 8 · MAGMA FOUNDRY ───────────────────────────────────────────
const magma_foundry = {
  palette: { bg:'#1a0808', ambient:'#ff5530', torchTint:'#ffa040',
             wallCap:'#c4503a', wallCapOpacity:0.55, grain:'#000000', dust:'#ff5530' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5);
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#2e1818');
    R(ctx, ox, oy, s, 0, 0, 32, 1, '#000');
    R(ctx, ox, oy, s, 0, 15, 32, 1, '#000');
    R(ctx, ox, oy, s, y % 2 === 0 ? 15 : -1, 1, 1, 14, '#000');
    R(ctx, ox, oy, s, y % 2 === 0 ? -1 : 15, 16, 1, 15, '#000');
    R(ctx, ox, oy, s, 1, 1, 13, 0.7, '#6a3a28', 0.85);
    if (v === 0) {
      STROKE(ctx, ox, oy, s, '#ff5530', 0.8, null, (_c, m, l) => { m(2,4); l(8,8); l(6,12); l(12,16); l(10,22); l(16,26); });
      STROKE(ctx, ox, oy, s, '#ffa040', 0.3, null, (_c, m, l) => { m(2,4); l(8,8); l(6,12); l(12,16); l(10,22); l(16,26); });
      C(ctx, ox, oy, s, 8, 8, 1, '#ffa040', 0.7);
    }
    if (v === 1) {
      STROKE(ctx, ox, oy, s, '#ff5530', 0.7, null, (_c, m, l) => { m(28,4); l(22,10); l(24,18); l(20,24); });
      STROKE(ctx, ox, oy, s, '#ffa040', 0.3, null, (_c, m, l) => { m(28,4); l(22,10); l(24,18); l(20,24); });
      C(ctx, ox, oy, s, 24, 18, 0.8, '#ffa040', 0.7);
    }
    if (v === 2) {
      C(ctx, ox, oy, s, 6, 22, 0.8, '#ff5530');
      C(ctx, ox, oy, s, 22, 6, 0.6, '#ffa040');
      C(ctx, ox, oy, s, 14, 20, 0.4, '#ff5530');
    }
    if (v === 3) {
      R(ctx, ox, oy, s, 10, 8, 2, 6, '#ff5530', 0.8);
      R(ctx, ox, oy, s, 10.5, 8.5, 1, 5, '#ffa040');
    }
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#1a0e0a','#1f120c','#170c08','#22140e','#180e0a'][v];
    const d = sdVariant(x, y, 12, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.5, '#000', 0.8);
    R(ctx, ox, oy, s, 0, 0, 0.5, 32, '#000', 0.8);
    R(ctx, ox, oy, s, 2, 22, 10, 0.5, '#3a2820', 0.6);
    if (d === 0) {
      E(ctx, ox, oy, s, 16, 18, 5, 2, '#3a0808');
      E(ctx, ox, oy, s, 16, 18, 3.5, 1.4, '#ff5530');
      E(ctx, ox, oy, s, 15, 17.5, 1.5, 0.5, '#ffe488', 0.8);
    }
    if (d === 1) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ff5530';
      ctx.lineWidth = 0.4 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 16 * s, 4 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#ffa040';
      ctx.font = `${5 * s}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✶', ox + 16 * s, oy + 18 * s);
      ctx.restore();
    }
    if (d === 2) C(ctx, ox, oy, s, 22, 10, 0.6, '#ff5530');
    if (d === 3) C(ctx, ox, oy, s, 10, 22, 0.5, '#ffa040', 0.7);
  }
};

// ───────── 9 · DROWNED CATACOMBS ───────────────────────────────────────
const drowned_catacombs = {
  palette: { bg:'#0a1620', ambient:'#6acaba', torchTint:'#a8e0d4',
             wallCap:'#a8e0d4', wallCapOpacity:0.55, grain:'#040a0e', dust:'#a8e0d4' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 6);
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#324848');
    R(ctx, ox, oy, s, 0, 0, 32, 1, '#08120c');
    R(ctx, ox, oy, s, 0, 15, 32, 1, '#08120c');
    R(ctx, ox, oy, s, y % 2 === 0 ? 15 : -1, 1, 1, 14, '#08120c');
    R(ctx, ox, oy, s, y % 2 === 0 ? -1 : 15, 16, 1, 15, '#08120c');
    R(ctx, ox, oy, s, 1, 1, 13, 0.7, '#7aa898', 0.85);
    L(ctx, ox, oy, s, 4, 1, 4, 14, '#0c1c1c', 0.4, 0.5);
    L(ctx, ox, oy, s, 8, 1, 8, 12, '#0c1c1c', 0.4, 0.5);
    L(ctx, ox, oy, s, 22, 1, 22, 13, '#0c1c1c', 0.4, 0.5);
    if (v === 0) {
      E(ctx, ox, oy, s, 8, 20, 3.5, 2, '#3a5848', 0.85);
      C(ctx, ox, oy, s, 6, 19, 0.8, '#6acaba', 0.85);
      C(ctx, ox, oy, s, 10, 21, 0.5, '#6acaba', 0.85);
    }
    if (v === 1) {
      POLY(ctx, ox, oy, s, '#a8e0d4', 0.7, [22,28, 23,24, 24,28, 25,26, 26,28]);
      POLY(ctx, ox, oy, s, '#3a5848', null, [22,28, 24,28, 26,28]);
    }
    if (v === 2) {
      C(ctx, ox, oy, s, 14, 6, 0.8, '#6acaba', 0.8);
      L(ctx, ox, oy, s, 14, 6, 14, 14, '#6acaba', 0.3, 0.4);
    }
    if (v === 3) E(ctx, ox, oy, s, 24, 22, 2, 1, '#3a5848', 0.7);
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#0c1820','#10202a','#0c1c24','#14242e','#0e1c24'][v];
    const d = sdVariant(x, y, 14, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.5, '#040a0e', 0.7);
    R(ctx, ox, oy, s, 0, 0, 0.5, 32, '#040a0e', 0.7);
    E(ctx, ox, oy, s, 16, 16, 10, 2, '#6acaba', 0.12);
    E(ctx, ox, oy, s, 16, 16, 6, 1.2, '#6acaba', 0.18);
    E(ctx, ox, oy, s, 20, 14, 3, 0.6, '#a8e0d4', 0.35);
    if (d === 0) {
      E(ctx, ox, oy, s, 14, 20, 2.5, 2, '#a8a890', 0.7);
      C(ctx, ox, oy, s, 13, 20, 0.5, '#08070c');
      C(ctx, ox, oy, s, 15, 20, 0.5, '#08070c');
    }
    if (d === 1) {
      L(ctx, ox, oy, s, 22, 22, 22, 18, '#6acaba', 0.5, 1);
      L(ctx, ox, oy, s, 22, 18, 20, 16, '#6acaba', 0.5, 1);
      L(ctx, ox, oy, s, 22, 18, 24, 16, '#6acaba', 0.5, 1);
      C(ctx, ox, oy, s, 22, 22, 0.6, '#6acaba', 0.7);
    }
    if (d === 2) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#a8e0d4';
      ctx.lineWidth = 0.3 * s;
      ctx.beginPath();
      ctx.arc(ox + 8 * s, oy + 10 * s, 0.8 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 0.2 * s;
      ctx.beginPath();
      ctx.arc(ox + 6 * s, oy + 14 * s, 0.4 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
};

// ───────── 10 · VOID SANCTUM ───────────────────────────────────────────
const void_sanctum = {
  palette: { bg:'#04020a', ambient:'#9a40e8', torchTint:'#c08aff',
             wallCap:'#c08aff', wallCapOpacity:0.6, grain:'#04020a', dust:'#c08aff' },
  wall(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 6);
    R(ctx, ox, oy, s, 0, 0, 32, 32, '#1a1024');
    // obsidian gloss
    const g = ctx.createLinearGradient(ox, oy, ox + size, oy + size);
    g.addColorStop(0, 'rgba(26,10,36,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ox, oy, size, size);
    // tile borders
    R(ctx, ox, oy, s, 0, 0, 32, 0.8, '#c08aff', 0.7);
    R(ctx, ox, oy, s, 0, 31.2, 32, 0.8, '#c08aff', 0.6);
    R(ctx, ox, oy, s, 0, 0, 0.8, 32, '#c08aff', 0.6);
    // stars
    const starPositions = [[5,7],[19,4],[28,12],[10,22],[24,26],[3,18]];
    for (let i = 0; i < starPositions.length; i++) {
      const [sx, sy] = starPositions[i];
      const px = sx + sdHash(x + i, y, 4) * 2 - 1;
      const py = sy + sdHash(x, y + i, 5) * 2 - 1;
      const r = 0.3 + sdHash(x + i, y + i, 6) * 0.5;
      const col = sdRoll(x + i, y, 0.3, 8) ? '#c08aff' : '#fff';
      C(ctx, ox, oy, s, px, py, r, col, 0.8);
    }
    if (v === 0) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#9a40e8';
      ctx.lineWidth = 0.4 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 16 * s, 6 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#c08aff';
      ctx.lineWidth = 0.3 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 16 * s, 4 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#c08aff';
      ctx.font = `${6 * s}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✷', ox + 16 * s, oy + 19 * s);
      ctx.restore();
    }
    if (v === 1) {
      C(ctx, ox, oy, s, 22, 22, 2, '#9a40e8', 0.5);
      C(ctx, ox, oy, s, 22, 22, 1, '#c08aff', 0.7);
    }
    if (v === 2) L(ctx, ox, oy, s, 4, 28, 10, 22, '#fff', 0.4, 0.7);
  },
  floor(ctx, ox, oy, size, x, y) {
    const s = size / 32;
    const v = sdVariant(x, y, 5, 1);
    const base = ['#08040e','#0c0612','#040208','#0a0410','#06030c'][v];
    const d = sdVariant(x, y, 12, 2);
    R(ctx, ox, oy, s, 0, 0, 32, 32, base);
    R(ctx, ox, oy, s, 0, 0, 32, 0.4, '#9a40e8', 0.2);
    R(ctx, ox, oy, s, 0, 0, 0.4, 32, '#9a40e8', 0.2);
    // star specks
    const specks = [[6,8],[20,16],[12,24]];
    for (let i = 0; i < specks.length; i++) {
      if (sdRoll(x + i, y, 0.5, 9)) {
        C(ctx, ox, oy, s, specks[i][0], specks[i][1], 0.3, '#fff', 0.7);
      }
    }
    if (d === 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#9a40e8';
      ctx.lineWidth = 0.3 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 16 * s, 6 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#c08aff';
      ctx.lineWidth = 0.25 * s;
      ctx.beginPath();
      ctx.arc(ox + 16 * s, oy + 16 * s, 3 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c08aff';
      ctx.font = `${4 * s}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚝', ox + 16 * s, oy + 17 * s);
      ctx.restore();
    }
    if (d === 1) {
      C(ctx, ox, oy, s, 18, 18, 1.5, '#9a40e8', 0.5);
      C(ctx, ox, oy, s, 18, 18, 0.6, '#c08aff', 0.5);
    }
    if (d === 2) C(ctx, ox, oy, s, 22, 10, 0.4, '#c08aff', 0.7);
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════════════

export const BIOME_TILES = {
  forgotten_crypts, bone_garden, frozen_halls, sunken_forest, iron_stronghold,
  sun_cursed_sands, mirror_vaults, magma_foundry, drowned_catacombs, void_sanctum
};

const BIOME_ORDER = [
  'forgotten_crypts', 'bone_garden', 'frozen_halls', 'sunken_forest', 'iron_stronghold',
  'sun_cursed_sands', 'mirror_vaults', 'magma_foundry', 'drowned_catacombs', 'void_sanctum'
];

/** 10 floors per biome. */
export function biomeIdForFloor(floorIndex) {
  const idx = Math.max(0, Math.min(BIOME_ORDER.length - 1, Math.floor(floorIndex / 10)));
  return BIOME_ORDER[idx];
}

export function getBiomePalette(biomeId) {
  return (BIOME_TILES[biomeId] || forgotten_crypts).palette;
}

export function hasBiome(biomeId) {
  return !!BIOME_TILES[biomeId];
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC DRAW API — wall + floor with universal overlays
// ═══════════════════════════════════════════════════════════════════════

/**
 * Draw a biome-styled wall tile. Internally:
 *   1. Biome-specific wall pattern (stones, runes, frost, lava, etc.)
 *   2. Universal wall cap (bright highlight along the top)
 *   3. Universal bottom shadow (grounds the wall onto the floor below)
 *   4. Side inner bevels
 */
export function drawBiomeWall(ctx, ox, oy, size, tileX, tileY, biomeId) {
  const biome = BIOME_TILES[biomeId] || BIOME_TILES.forgotten_crypts;
  const s = size / 32;

  biome.wall(ctx, ox, oy, size, tileX, tileY);

  // Universal cap + shadow + side bevels.
  const pal = biome.palette;
  const cap = pal.wallCap || '#ffffff';
  const capOp = pal.wallCapOpacity != null ? pal.wallCapOpacity : 0.35;
  R(ctx, ox, oy, s, 0, 0, 32, 1.4, cap, capOp);
  R(ctx, ox, oy, s, 0, 1.4, 32, 0.6, cap, capOp * 0.4);
  R(ctx, ox, oy, s, 0, 28, 32, 4, '#000', 0.55);
  R(ctx, ox, oy, s, 0, 30, 32, 2, '#000', 0.75);
  R(ctx, ox, oy, s, 0, 0, 0.8, 32, '#000', 0.4);
  R(ctx, ox, oy, s, 31.2, 0, 0.8, 32, '#000', 0.4);
}

/**
 * Draw a biome-styled floor tile + grain overlay (motes + scratches +
 * corner catch).
 */
export function drawBiomeFloor(ctx, ox, oy, size, tileX, tileY, biomeId) {
  const biome = BIOME_TILES[biomeId] || BIOME_TILES.forgotten_crypts;
  const s = size / 32;
  biome.floor(ctx, ox, oy, size, tileX, tileY);

  // FloorGrain overlay — deterministic motes & scratches per tile.
  const pal = biome.palette;
  const grainColor = pal.grain || '#000';
  const dustColor = pal.dust || pal.ambient || '#888';

  // Optional darker stain blob (~15%).
  if (sdRoll(tileX, tileY, 0.15, 41)) {
    E(ctx, ox, oy, s,
      sdHash(tileX, tileY, 50) * 24 + 4,
      sdHash(tileX, tileY, 51) * 24 + 4,
      2 + sdHash(tileX, tileY, 52) * 2,
      1 + sdHash(tileX, tileY, 53) * 1.5,
      grainColor, 0.22);
  }

  // 7 candidate motes, ~55% accepted each.
  for (let i = 0; i < 7; i++) {
    if (!sdRoll(tileX + i, tileY, 0.55, 30 + i)) continue;
    const mx = sdHash(tileX, tileY + i, 31 + i) * 30 + 1;
    const my = sdHash(tileX + i, tileY, 32 + i) * 30 + 1;
    const r = 0.25 + sdHash(tileX, tileY, 33 + i) * 0.6;
    const isDust = sdRoll(tileX, tileY + i, 0.45, 34 + i);
    C(ctx, ox, oy, s, mx, my, r,
      isDust ? dustColor : grainColor,
      isDust ? 0.22 : 0.55);
  }

  // Occasional scratch.
  if (sdRoll(tileX, tileY, 0.25, 40)) {
    L(ctx, ox, oy, s,
      sdHash(tileX, tileY, 60) * 26 + 2,
      sdHash(tileX, tileY, 61) * 26 + 2,
      sdHash(tileX, tileY, 60) * 26 + 4 + sdHash(tileX, tileY, 62) * 4,
      sdHash(tileX, tileY, 61) * 26 + 4 + sdHash(tileX, tileY, 63) * 4,
      grainColor, 0.4, 0.45);
  }

  // Corner highlight catches torch light.
  R(ctx, ox, oy, s, 0.5, 0.5, 6, 0.5, dustColor, 0.18);
  R(ctx, ox, oy, s, 0.5, 0.5, 0.5, 6, dustColor, 0.18);
}

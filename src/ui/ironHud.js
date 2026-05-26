/**
 * Iron Portcullis HUD — shared drawing primitives.
 *
 * Canvas equivalents of the IronHUD JSX components. Used by MobileControls
 * and QuickUseBar to share the same wrought-iron visual language: hammered
 * plates, bevelled rivets, brass accents, ember keyhole glows on active.
 */

export const IRON = {
  ink:       '#08060c',
  plate1:    '#4a3c44',
  plate0:    '#1a1218',
  plate2:    '#2a2230',
  plateHi:   '#6a5e6a',
  brass:     '#d4ac6c',
  brassDark: '#7a5e34',
  brassDeep: '#2a1808',
  brassHi:   '#f1d49a',
  ember:     '#ff8844',
  emberDeep: '#5a2010',
  bone:      '#cfc2a4',
  boneDim:   '#8a8068',
  rune:      '#7faafa',
  runeDeep:  '#2a4a7a',
  blood:     '#c4503a'
};

/**
 * Hammered iron plate with bevel + corner rivets + optional glow.
 * Mimics CSS `linear-gradient(180deg, plate1 → plate0)` + inset shadows.
 */
export function drawIronPlate(ctx, x, y, w, h, opts = {}) {
  const { pressed = false, glow = null, rivets = true } = opts;
  // Background gradient
  const g = ctx.createLinearGradient(x, y, x, y + h);
  if (pressed) {
    g.addColorStop(0, IRON.plate0);
    g.addColorStop(1, IRON.plate2);
  } else {
    g.addColorStop(0, IRON.plate1);
    g.addColorStop(1, IRON.plate0);
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // Hammered texture: scattered radial highlights & pits
  ctx.save();
  ctx.globalAlpha = pressed ? 0.06 : 0.10;
  ctx.fillStyle = '#a09aa0';
  for (const [px, py, rad] of [[0.22, 0.28, 0.22], [0.72, 0.62, 0.20], [0.42, 0.85, 0.18]]) {
    const cx = x + w * px, cy = y + h * py;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * rad);
    rg.addColorStop(0, 'rgba(160,150,160,0.9)');
    rg.addColorStop(1, 'rgba(160,150,160,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 0.22;
  for (const [px, py] of [[0.38, 0.82], [0.88, 0.12]]) {
    const cx = x + w * px, cy = y + h * py;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.28);
    rg.addColorStop(0, 'rgba(15,12,18,0.7)');
    rg.addColorStop(1, 'rgba(15,12,18,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  // Top highlight + bottom shadow (bevel)
  ctx.fillStyle = pressed ? IRON.ink : IRON.plateHi;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillStyle = IRON.ink;
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);

  // Border
  ctx.strokeStyle = IRON.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Outer glow
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  // Corner rivets
  if (rivets) {
    drawIronRivet(ctx, x + 4, y + 4, 2.5);
    drawIronRivet(ctx, x + w - 4, y + 4, 2.5);
    drawIronRivet(ctx, x + 4, y + h - 4, 2.5);
    drawIronRivet(ctx, x + w - 4, y + h - 4, 2.5);
  }
}

/** Small hemispherical iron rivet (steel-silver radial). */
export function drawIronRivet(ctx, cx, cy, r = 2.5) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  g.addColorStop(0, '#9a8e9a');
  g.addColorStop(0.65, '#2a2230');
  g.addColorStop(1, IRON.ink);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Brass rivet — used on corner gussets and brass-trimmed accents. */
export function drawBrassRivet(ctx, cx, cy, r = 3) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  g.addColorStop(0, IRON.brassHi);
  g.addColorStop(0.4, IRON.brass);
  g.addColorStop(0.85, IRON.brassDark);
  g.addColorStop(1, IRON.brassDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = IRON.ink;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Brass jewel (radial — used for D-pad WAIT center, top-row accent buttons).
 * Variants: 'brass' | 'ember' | 'rune'
 */
export function drawBrassJewel(ctx, cx, cy, r, opts = {}) {
  const { pressed = false, variant = 'brass', glyph = null } = opts;
  let inner, deep, hi, glyphColor;
  if (variant === 'rune') {
    inner = IRON.rune; deep = IRON.runeDeep; hi = '#bfd6ff'; glyphColor = IRON.ink;
  } else if (variant === 'ember') {
    inner = IRON.ember; deep = IRON.emberDeep; hi = '#ffd4a8'; glyphColor = IRON.ink;
  } else {
    inner = IRON.brass; deep = IRON.brassDark; hi = IRON.brassHi; glyphColor = IRON.ink;
  }
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  if (pressed) {
    g.addColorStop(0, deep);
    g.addColorStop(1, IRON.ink);
  } else {
    g.addColorStop(0, hi);
    g.addColorStop(0.35, inner);
    g.addColorStop(0.8, deep);
    g.addColorStop(1, IRON.brassDeep);
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = IRON.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (glyph) {
    ctx.fillStyle = glyphColor;
    ctx.font = `bold ${Math.round(r)}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, cx, cy + 1);
  }
}

/**
 * Wrought-iron lattice bars behind the D-pad — horizontal + vertical
 * iron strips with a central square, all gradient-shaded.
 */
export function drawIronLattice(ctx, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  // Horizontal bar
  const hg = ctx.createLinearGradient(x, cy - size * 0.07, x, cy + size * 0.07);
  hg.addColorStop(0, IRON.plateHi);
  hg.addColorStop(0.5, IRON.plate2);
  hg.addColorStop(1, IRON.ink);
  ctx.fillStyle = hg;
  ctx.fillRect(x + size * 0.1, cy - size * 0.07, size * 0.8, size * 0.14);
  ctx.strokeStyle = IRON.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + size * 0.1, cy - size * 0.07, size * 0.8, size * 0.14);

  // Vertical bar
  const vg = ctx.createLinearGradient(cx - size * 0.07, y, cx + size * 0.07, y);
  vg.addColorStop(0, IRON.plateHi);
  vg.addColorStop(0.5, IRON.plate2);
  vg.addColorStop(1, IRON.ink);
  ctx.fillStyle = vg;
  ctx.fillRect(cx - size * 0.07, y + size * 0.1, size * 0.14, size * 0.8);
  ctx.strokeRect(cx - size * 0.07, y + size * 0.1, size * 0.14, size * 0.8);

  // Center plate square
  ctx.fillStyle = IRON.plate2;
  ctx.fillRect(cx - size * 0.12, cy - size * 0.12, size * 0.24, size * 0.24);
  ctx.strokeRect(cx - size * 0.12, cy - size * 0.12, size * 0.24, size * 0.24);
}

/** Brass piping line — gradient gold accent (top/bottom of HUD panel). */
export function drawBrassPiping(ctx, x, y, w) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, 'rgba(212,172,108,0)');
  g.addColorStop(0.3, IRON.brass);
  g.addColorStop(0.5, IRON.brassHi);
  g.addColorStop(0.7, IRON.brass);
  g.addColorStop(1, 'rgba(212,172,108,0)');
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 1);
  ctx.restore();
}

/**
 * Perimeter rivet studs along an edge.
 * @param {string} edge 'top'|'bottom'|'left'|'right'
 */
export function drawPerimeterStuds(ctx, rect, edge, count) {
  for (let i = 0; i < count; i++) {
    const pct = (i + 1) / (count + 1);
    let cx, cy;
    if (edge === 'top')    { cx = rect.x + rect.w * pct; cy = rect.y + 4; }
    else if (edge === 'bottom') { cx = rect.x + rect.w * pct; cy = rect.y + rect.h - 4; }
    else if (edge === 'left')   { cx = rect.x + 4; cy = rect.y + rect.h * pct; }
    else                  { cx = rect.x + rect.w - 4; cy = rect.y + rect.h * pct; }
    drawIronRivet(ctx, cx, cy, 3);
  }
}

/** Horizontal iron seam strap with rivets. */
export function drawSeamStrap(ctx, x, y, w) {
  const g = ctx.createLinearGradient(0, y, 0, y + 5);
  g.addColorStop(0, 'rgba(74,60,68,0.7)');
  g.addColorStop(1, IRON.ink);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 5);
  ctx.fillStyle = 'rgba(106,94,106,0.4)';
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = IRON.ink;
  ctx.fillRect(x, y + 4, w, 1);
  // rivets every ~12%
  for (let i = 1; i <= 8; i++) {
    const cx = x + (i / 9) * w;
    drawIronRivet(ctx, cx, y + 2.5, 2);
  }
}

/** L-shaped brass-trimmed corner gusset. */
export function drawCornerGusset(ctx, x, y, w, h, corner) {
  const isTop = corner[0] === 't';
  const isLeft = corner[1] === 'l';
  // Vertical arm
  const vArmW = 8;
  const vx = isLeft ? x : x + w - vArmW;
  ctx.fillStyle = IRON.plate1;
  ctx.fillRect(vx, y, vArmW, h);
  // Horizontal arm
  const hArmH = 8;
  const hy = isTop ? y : y + h - hArmH;
  ctx.fillStyle = IRON.plate1;
  ctx.fillRect(x, hy, w, hArmH);
  // Highlights
  ctx.fillStyle = 'rgba(106,94,106,0.5)';
  ctx.fillRect(vx, y, vArmW, 1);
  ctx.fillRect(x, hy, w, 1);
  ctx.fillStyle = IRON.ink;
  ctx.fillRect(vx, y + h - 1, vArmW, 1);
  ctx.fillRect(x, hy + hArmH - 1, w, 1);
  // Brass trim along inner edge
  ctx.fillStyle = IRON.brassDark;
  if (isLeft) ctx.fillRect(vx, y, 1, h);
  else        ctx.fillRect(vx + vArmW - 1, y, 1, h);
  if (isTop)  ctx.fillRect(x, hy, w, 1);
  else        ctx.fillRect(x, hy + hArmH - 1, w, 1);
  // Corner brass stud
  const sx = isLeft ? x : x + w - 1;
  const sy = isTop ? y : y + h - 1;
  drawBrassRivet(ctx, sx, sy, 5);
}

/**
 * Reticle for the AIM button — crosshair with center dot.
 * @param {boolean} enabled
 */
export function drawReticle(ctx, cx, cy, r, enabled) {
  const col = enabled ? IRON.ember : IRON.boneDim;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  // Crosshair lines
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - r * 0.45);
  ctx.moveTo(cx, cy + r * 0.45); ctx.lineTo(cx, cy + r);
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx - r * 0.45, cy);
  ctx.moveTo(cx + r * 0.45, cy); ctx.lineTo(cx + r, cy);
  ctx.stroke();
}

/** Direction arrow for AIM target indicator. */
export function dirArrowGlyph(dir) {
  return ({ n: '↑', ne: '↗', e: '→', se: '↘', s: '↓', sw: '↙', w: '←', nw: '↖' })[dir] || '·';
}

/** 8-way direction from delta. */
export function deltaToDir(dx, dy) {
  if (dx === 0 && dy < 0) return 'n';
  if (dx === 0 && dy > 0) return 's';
  if (dy === 0 && dx > 0) return 'e';
  if (dy === 0 && dx < 0) return 'w';
  if (dx > 0 && dy < 0) return 'ne';
  if (dx > 0 && dy > 0) return 'se';
  if (dx < 0 && dy > 0) return 'sw';
  if (dx < 0 && dy < 0) return 'nw';
  return null;
}

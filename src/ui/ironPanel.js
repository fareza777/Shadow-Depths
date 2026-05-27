/**
 * Iron-screen primitives — bigger versions of the HUD pieces in ironHud.js.
 *
 * Used to assemble full-screen iron-clad UI like Satchel, Vigil and Pause
 * (matching iron-screens.jsx). The HUD module owns the small D-pad iron
 * vocabulary; this module owns the larger panel chrome, progress bars and
 * action buttons that share the same wrought-iron language.
 */
import { IRON, drawIronPlate, drawIronRivet, drawBrassRivet } from './ironHud.js';
import { FONT_DISPLAY, FONT_MONO } from '../config/constants.js';

const ink   = IRON.ink;
const brass = IRON.brass;
const brassDark = IRON.brassDark;
const brassHi  = IRON.brassHi;
const brassDeep = IRON.brassDeep || '#2a1808';
const plate1 = IRON.plate1;
const plate0 = IRON.plate0;
const plate2 = IRON.plate2;
const plateHi = IRON.plateHi;
const bone   = IRON.bone || '#cfc2a4';
const boneDim = IRON.boneDim || '#8a8068';
const boneDark = '#5a5240';

// Rarity colours (mirrors iron-screens.jsx IRON.rarity).
export const IRON_RARITY = {
  common:   '#8b8378',
  uncommon: '#6b9156',
  rare:     '#4a7eb8',
  epic:     '#9a5fb8',
  legendary:'#d4ac6c'
};

export function rarityColor(r) {
  return IRON_RARITY[r] || IRON_RARITY.common;
}

// ─────────────────────────────────────────────────────────────────
// IRON PANEL — full-bleed iron sheet (gradient + studs + gussets)
// ─────────────────────────────────────────────────────────────────
/**
 * Paint the entire iron-clad panel chrome behind a screen's content.
 * Caller is responsible for drawing the content layer on top.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x panel top-left
 * @param {number} y
 * @param {number} w panel width
 * @param {number} h panel height
 */
export function drawIronPanel(ctx, x, y, w, h) {
  // 1. Body gradient — top→middle→bottom (matches iron-screens.jsx).
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0,    '#1f1820');
  g.addColorStop(0.45, '#120c14');
  g.addColorStop(0.75, '#0c080e');
  g.addColorStop(1,    '#1a1218');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // 2. Hammered radial highlights/shadows (PanelTexture).
  drawPanelTexture(ctx, x, y, w, h);

  // 3. Outer 3px ink border.
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.restore();

  // 4. Inset brass ring (1px), 0.67 alpha.
  ctx.save();
  ctx.globalAlpha = 0.67;
  ctx.strokeStyle = brassDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  ctx.restore();

  // 5. Top inset highlight (2px plateHi @ ~0.27).
  ctx.save();
  ctx.globalAlpha = 0.27;
  ctx.fillStyle = plateHi;
  ctx.fillRect(x + 3, y + 4, w - 6, 2);
  ctx.restore();

  // 6. Bottom inset shadow (3px ink).
  ctx.fillStyle = ink;
  ctx.fillRect(x + 3, y + h - 6, w - 6, 3);

  // 7. Brass piping top + bottom.
  drawPanelBrassPipe(ctx, x + 24, y + 10, w - 48);
  drawPanelBrassPipe(ctx, x + 24, y + h - 10, w - 48);

  // 8. Corner gussets (L-brackets with brass nub).
  drawPanelGusset(ctx, x, y, 'tl');
  drawPanelGusset(ctx, x + w, y, 'tr');
  drawPanelGusset(ctx, x, y + h, 'bl');
  drawPanelGusset(ctx, x + w, y + h, 'br');

  // 9. Perimeter rivet studs (6 top, 6 bottom, 8 each side).
  drawPanelStuds(ctx, x, y, w, h);
}

function drawPanelTexture(ctx, x, y, w, h) {
  const spots = [
    { px: 0.08, py: 0.18, r: 0.14, c: 'rgba(170,160,170,0.10)' },
    { px: 0.68, py: 0.22, r: 0.14, c: 'rgba(170,160,170,0.08)' },
    { px: 0.22, py: 0.86, r: 0.22, c: 'rgba(15,10,15,0.55)' },
    { px: 0.92, py: 0.58, r: 0.20, c: 'rgba(15,10,15,0.45)' },
    { px: 0.52, py: 0.50, r: 0.30, c: 'rgba(170,160,170,0.04)' }
  ];
  for (const s of spots) {
    const cx = x + w * s.px;
    const cy = y + h * s.py;
    const r = Math.min(w, h) * s.r;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, s.c);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }
}

function drawPanelBrassPipe(ctx, x, y, w) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0,    'transparent');
  g.addColorStop(0.2,  brass);
  g.addColorStop(0.5,  brassHi);
  g.addColorStop(0.8,  brass);
  g.addColorStop(1,    'transparent');
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 1);
  ctx.restore();
}

function drawPanelGusset(ctx, cornerX, cornerY, which) {
  const size = 22;
  const isTop = which[0] === 't';
  const isLeft = which[1] === 'l';
  // L-shape origin (offset 6 from panel corner)
  const ox = isLeft ? cornerX + 6 : cornerX - 6 - size;
  const oy = isTop  ? cornerY + 6 : cornerY - 6 - size;

  // Vertical arm of the L.
  const vGrad = ctx.createLinearGradient(ox, oy, ox + size, oy);
  vGrad.addColorStop(0, isLeft ? plate1 : plate0);
  vGrad.addColorStop(1, isLeft ? plate0 : plate1);
  ctx.fillStyle = vGrad;
  const vx = isLeft ? ox : ox + size - 7;
  ctx.fillRect(vx, oy, 7, size);
  ctx.strokeStyle = brassDark;
  ctx.lineWidth = 1;
  if (isLeft) ctx.strokeRect(vx + 0.5, oy + 0.5, 0.5, size - 1);
  else        ctx.strokeRect(vx + 6.5, oy + 0.5, 0.5, size - 1);

  // Horizontal arm of the L.
  const hGrad = ctx.createLinearGradient(ox, oy, ox, oy + size);
  hGrad.addColorStop(0, isTop ? plate0 : plate1);
  hGrad.addColorStop(1, isTop ? plate1 : plate0);
  ctx.fillStyle = hGrad;
  const hy = isTop ? oy : oy + size - 7;
  ctx.fillRect(ox, hy, size, 7);
  if (isTop) {
    ctx.strokeStyle = brassDark;
    ctx.beginPath(); ctx.moveTo(ox, hy + 0.5); ctx.lineTo(ox + size, hy + 0.5); ctx.stroke();
  } else {
    ctx.strokeStyle = brassDark;
    ctx.beginPath(); ctx.moveTo(ox, hy + 6.5); ctx.lineTo(ox + size, hy + 6.5); ctx.stroke();
  }

  // Brass nub at corner.
  const nx = isLeft ? ox - 1 : ox + size - 8;
  const ny = isTop  ? oy - 1 : oy + size - 8;
  const ng = ctx.createRadialGradient(nx + 3, ny + 3, 0, nx + 4.5, ny + 4.5, 5);
  ng.addColorStop(0, brassHi);
  ng.addColorStop(0.35, brass);
  ng.addColorStop(0.75, brassDark);
  ng.addColorStop(1, brassDeep);
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.arc(nx + 4.5, ny + 4.5, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPanelStuds(ctx, x, y, w, h) {
  const studAt = (sx, sy) => {
    const g = ctx.createRadialGradient(sx - 1, sy - 1, 0, sx, sy, 3);
    g.addColorStop(0, '#9a8e9a');
    g.addColorStop(0.7, '#1f1820');
    g.addColorStop(1, ink);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  };
  // 6 along top + bottom (interior of brass piping)
  for (let i = 0; i < 6; i++) {
    const p = (i + 1) / 7;
    studAt(x + w * p, y + 6.5);
    studAt(x + w * p, y + h - 6.5);
  }
  // 8 along left + right
  for (let i = 0; i < 8; i++) {
    const p = (i + 1) / 9;
    studAt(x + 6.5, y + h * p);
    studAt(x + w - 6.5, y + h * p);
  }
}

// ─────────────────────────────────────────────────────────────────
// PROGRESS BAR — horizontal fill with optional thick mode
// ─────────────────────────────────────────────────────────────────
export function drawProgressBar(ctx, x, y, w, h, value, max, color) {
  // Recessed track.
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = plate2;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  if (pct <= 0) return;

  // Fill — vertical gradient color → color@semi.
  const fillW = Math.max(1, Math.round(w * pct));
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, hexAlpha(color, 0.67));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, fillW, h);

  // Inner top highlight.
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 1, y + 1, fillW - 2, 1);
  ctx.restore();

  // Glow.
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, fillW - 1, h - 1);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
// ACTION BUTTON — large iron plate with display-font label
// ─────────────────────────────────────────────────────────────────
/**
 * @param {object} renderer  Renderer with drawText
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} label
 * @param {{ accent?:string, disabled?:boolean, pressed?:boolean, glyph?:string, rivets?:boolean, fontSize?:number }} [opts]
 */
export function drawIronActionButton(renderer, x, y, w, h, label, opts = {}) {
  const ctx = renderer.ctx;
  const { accent, disabled, pressed, glyph, rivets = true, fontSize = 13 } = opts;
  const color = disabled ? boneDark : (accent || bone);

  ctx.save();
  if (disabled) ctx.globalAlpha = 0.45;
  drawIronPlate(ctx, x, y, w, h, {
    pressed, glow: accent && !disabled ? accent : null, rivets
  });
  ctx.restore();

  // Glyph (optional) + label centered.
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.55;
  if (glyph) {
    ctx.font = `${Math.round(h * 0.45)}px serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x + w / 2 - (label ? w * 0.18 : 0), y + h / 2);
  }
  ctx.font = `bold ${fontSize}px ${FONT_DISPLAY}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Letter spacing approximated by spreading characters.
  const text = label.toUpperCase();
  const labelX = x + w / 2 + (glyph ? w * 0.12 : 0);
  drawSpacedText(ctx, text, labelX, y + h / 2, 3);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
// BIG SLOT — recessed iron well with rarity border (inventory)
// ─────────────────────────────────────────────────────────────────
export function drawIronSlot(ctx, x, y, w, h, opts = {}) {
  const { selected, rarity, empty } = opts;
  // Recessed body.
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, plate0);
  grad.addColorStop(1, ink);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Inner darker depth.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12);

  // Border — rarity if filled, dim if empty.
  const borderColor = selected ? brass : (empty ? plate2 : (rarity ? rarityColor(rarity) : plate2));
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Outer ink frame.
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);

  // 4 corner rivets.
  drawIronRivet(ctx, x + 5, y + 5, 1.8);
  drawIronRivet(ctx, x + w - 5, y + 5, 1.8);
  drawIronRivet(ctx, x + 5, y + h - 5, 1.8);
  drawIronRivet(ctx, x + w - 5, y + h - 5, 1.8);

  // Subtle inset highlight on top + dark on bottom (depth).
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = plateHi;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
// INSET CARD — recessed sub-panel (detail strip, stats table)
// ─────────────────────────────────────────────────────────────────
export function drawInsetCard(ctx, x, y, w, h, opts = {}) {
  const { borderColor = ink } = opts;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, plate0);
  grad.addColorStop(1, ink);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Top inset highlight + bottom inset shadow.
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = plateHi;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.fillRect(x + 1, y + h - 3, w - 2, 2);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
// EQUIP ROW — equipment list line (Vigil character sheet)
// ─────────────────────────────────────────────────────────────────
export function drawEquipRow(renderer, x, y, w, h, slot, item) {
  const ctx = renderer.ctx;
  const has = !!item;
  const col = has ? rarityColor(item.rarity) : boneDark;

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  if (has) { grad.addColorStop(0, plate1); grad.addColorStop(1, plate0); }
  else     { grad.addColorStop(0, plate0); grad.addColorStop(1, ink); }
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = has ? col : plate2;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Optional subtle glow when filled.
  if (has) {
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = col;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  // Icon box on the left.
  const ico = h - 12;
  const iconX = x + 6, iconY = y + 6;
  ctx.fillStyle = ink;
  ctx.fillRect(iconX, iconY, ico, ico);
  ctx.strokeStyle = has ? col : plate2;
  ctx.strokeRect(iconX + 0.5, iconY + 0.5, ico - 1, ico - 1);
  if (has) {
    // Soft rarity backwash so the sprite reads against the dark slot.
    ctx.save();
    ctx.globalAlpha = 0.18;
    const rg = ctx.createRadialGradient(
      iconX + ico / 2, iconY + ico / 2, 0,
      iconX + ico / 2, iconY + ico / 2, ico * 0.7
    );
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(iconX + 1, iconY + 1, ico - 2, ico - 2);
    ctx.restore();
    // Actual item sprite. Padded 2px inside the slot frame. Affix overlay
    // (gem socket / blade glow) layers on top via SpriteRegistry.draw.
    if (item.spriteKey && renderer.sprites?.draw) {
      renderer.sprites.draw(item.spriteKey, ctx,
        iconX + 2, iconY + 2,
        { size: ico - 4, tint: col, affixes: item.def?.affixes || null });
    } else {
      ctx.fillStyle = col;
      ctx.font = `${Math.round(ico * 0.65)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slotGlyph(slot), iconX + ico / 2, iconY + ico / 2 + 1);
    }
    // Rarity gem in the bottom-right corner of the slot icon.
    const gemR = Math.max(2, Math.round(ico * 0.10));
    const gx = iconX + ico - gemR - 2;
    const gy = iconY + ico - gemR - 2;
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gemR);
    gg.addColorStop(0, '#ffffff');
    gg.addColorStop(0.5, col);
    gg.addColorStop(1, ink);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(gx, gy, gemR, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Empty slot — show the slot glyph as a faint hint.
    ctx.fillStyle = boneDark;
    ctx.font = `${Math.round(ico * 0.65)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slotGlyph(slot), iconX + ico / 2, iconY + ico / 2 + 1);
  }

  // Text column.
  const tx = iconX + ico + 10;
  const tw = w - (tx - x) - 90;

  ctx.font = `9px ${FONT_MONO}`;
  ctx.fillStyle = boneDim;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(slot.toUpperCase(), tx, y + 6);

  if (has) {
    ctx.font = `bold 13px ${FONT_DISPLAY}`;
    ctx.fillStyle = col;
    // Truncate name if too wide.
    const name = item.name || '—';
    const drawn = truncate(ctx, name.toUpperCase(), tw);
    ctx.fillText(drawn, tx, y + 18);
    // Stat summary.
    if (item.stats) {
      const parts = [];
      for (const [k, v] of Object.entries(item.stats)) {
        if (!v) continue;
        const prefix = v > 0 ? '+' : '';
        parts.push(`${prefix}${v} ${k.toUpperCase()}`);
      }
      ctx.font = `9px ${FONT_MONO}`;
      ctx.fillStyle = boneDim;
      ctx.fillText(parts.join('  '), tx, y + h - 14);
    }
  } else {
    ctx.font = `bold 12px ${FONT_DISPLAY}`;
    ctx.fillStyle = boneDark;
    ctx.textAlign = 'center';
    drawSpacedText(ctx, '— EMPTY —', tx + 48, y + h / 2 + 4, 2);
  }

  // UNEQUIP chip on the right (only when filled).
  let chipRect = null;
  if (has) {
    const cw = 76, ch = 26;
    const cx = x + w - cw - 8;
    const cy = y + (h - ch) / 2;
    drawIronPlate(ctx, cx, cy, cw, ch, { rivets: false });
    ctx.font = `bold 9px ${FONT_DISPLAY}`;
    ctx.fillStyle = brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawSpacedText(ctx, 'UNEQUIP', cx + cw / 2, cy + ch / 2, 2);
    chipRect = { x: cx, y: cy, w: cw, h: ch };
  }
  return { chipRect };
}

function slotGlyph(slot) {
  return { weapon:'⚔', helm:'⛨', armor:'☗', legs:'⬓',
           necklace:'◯', ring:'◎' }[slot] || '◆';
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
/** Approximated letter-spacing — draws each char with a horizontal gap. */
export function drawSpacedText(ctx, text, centerX, centerY, spacing) {
  const widths = [];
  let total = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    widths.push(w);
    total += w + spacing;
  }
  total -= spacing;
  let x = centerX - total / 2;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x + widths[i] / 2, centerY);
    x += widths[i] + spacing;
  }
}

export function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function hexAlpha(hex, alpha) {
  if (hex.startsWith('#') && hex.length === 7) {
    const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
    return hex + a;
  }
  return hex;
}

// Re-export commonly-used iron constants so screens don't need to import
// from two places.
export { IRON, drawIronPlate, drawIronRivet, drawBrassRivet };
export const IRON_FONTS = { display: FONT_DISPLAY, mono: FONT_MONO };
export const IRON_PALETTE = {
  ink, brass, brassDark, brassHi, brassDeep,
  bone, boneDim, boneDark, plate1, plate0, plate2, plateHi,
  blood: '#c4503a', ember: IRON.ember || '#ff8844'
};

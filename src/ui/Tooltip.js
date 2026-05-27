/**
 * Tooltip — small contextual popup for items / equipment.
 *
 * Rendered on top of inventory & equipment slot panels. The caller is
 * responsible for deciding WHEN to open it (e.g. on long-press in
 * InventoryUI). This module just owns the visual.
 *
 * Layout: anchored to the trigger rect, opens upward unless that would
 * clip; auto-fits to viewport.
 */
import { CANVAS_WIDTH, FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize, COLOR } from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { IRON } from './ironHud.js';
import { displayName } from '../items/Identification.js';

const BRASS = '#d4ac6c';
const BRASS_HI = '#f1d49a';

const RARITY_COLORS = {
  common:    '#cfc2a4',
  uncommon:  '#88c656',
  rare:      '#7faafa',
  epic:      '#c884e8',
  legendary: '#d4ac6c'
};

export class Tooltip {
  constructor() {
    this.open = false;
    this.item = null;
    this.anchor = null;
    this.meta = null;
  }

  show(item, anchor, meta) {
    if (!item) return;
    this.open = true;
    this.item = item;
    this.anchor = anchor || null;
    this.meta = meta || null;
  }

  hide() {
    this.open = false;
    this.item = null;
    this.anchor = null;
  }

  render(renderer) {
    if (!this.open || !this.item) return;
    const ctx = renderer.ctx;
    const item = this.item;
    const name = displayName(item, this.meta);
    const identified = name === item.name;

    // Build the line list dynamically — we measure to size the box.
    const lines = [];
    lines.push({ text: name, kind: 'title', color: RARITY_COLORS[item.rarity] || RARITY_COLORS.common });
    if (item.slot) lines.push({ text: item.slot.toUpperCase(), kind: 'sub', color: BRASS });
    if (identified) {
      if (item.stats) {
        const parts = [];
        for (const [k, v] of Object.entries(item.stats)) {
          if (!v) continue;
          parts.push(`${v > 0 ? '+' : ''}${v} ${k.toUpperCase()}`);
        }
        if (parts.length) lines.push({ text: parts.join('  ·  '), kind: 'stat' });
      }
      if (item.def?.affixes) {
        if (item.def.affixes.prefix) {
          lines.push({ text: `Prefix · ${item.def.affixes.prefix}`, kind: 'affix', color: '#bcd6ff' });
        }
        if (item.def.affixes.suffix) {
          lines.push({ text: `Suffix · ${item.def.affixes.suffix}`, kind: 'affix', color: '#f0c0a0' });
        }
      }
      const trig = item.def?.triggers || item.triggers;
      if (Array.isArray(trig) && trig.length) {
        for (const t of trig) {
          const when = t.when || '?';
          const tag  = t.chance ? `${Math.round(t.chance * 100)}%` : '';
          const eff  = t.do?.type || 'fx';
          lines.push({ text: `• ${when}${tag ? ` (${tag})` : ''} → ${eff}`, kind: 'trigger', color: '#a0d0ff' });
        }
      }
      if (item.lore) lines.push({ text: item.lore, kind: 'lore', color: IRON.boneDim });
    } else {
      lines.push({ text: 'Use or equip to identify.', kind: 'lore', color: IRON.boneDim });
    }

    const padX = 10, padY = 10, lineGap = 4;
    const widths = [];
    ctx.save();
    for (const ln of lines) {
      const sz = ln.kind === 'title' ? 14 : (ln.kind === 'lore' ? 11 : 12);
      ctx.font = `${ln.kind === 'title' ? 'bold ' : ''}${sz}px ${ln.kind === 'lore' ? FONT_BODY : FONT_DISPLAY}`;
      widths.push(ctx.measureText(ln.text).width);
    }
    ctx.restore();
    const w = Math.min(Layout.canvasW - 24, Math.max(160, Math.max(...widths) + padX * 2));
    const lineH = (kind) => uiSize(kind === 'title' ? 16 : (kind === 'lore' ? 13 : 14));
    let h = padY * 2;
    for (const ln of lines) h += lineH(ln.kind) + lineGap;

    // Position above the anchor; fall back to below if not enough room.
    const a = this.anchor || { x: CANVAS_WIDTH / 2 - w / 2, y: 80, w: 0, h: 0 };
    let x = Math.max(12, Math.min(CANVAS_WIDTH - w - 12, a.x + a.w / 2 - w / 2));
    let y = a.y - h - 6;
    if (y < 12) y = a.y + a.h + 6;

    // Plate + brass border
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, IRON.plate1);
    g.addColorStop(1, IRON.plate0);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();

    let ly = y + padY;
    for (const ln of lines) {
      const sz = ln.kind === 'title' ? 14 : (ln.kind === 'lore' ? 11 : 12);
      renderer.drawText(ln.text, x + padX, ly, {
        size: uiSize(sz),
        bold: ln.kind === 'title',
        italic: ln.kind === 'lore',
        align: 'left',
        family: ln.kind === 'lore' ? FONT_BODY : (ln.kind === 'stat' ? FONT_MONO : FONT_DISPLAY),
        color: ln.color || COLOR.textPrimary
      });
      ly += lineH(ln.kind) + lineGap;
    }
  }
}

/**
 * SkillsModal — full-canvas overlay listing the skills acquired this run and
 * the active fury/ward/hunt/arcane synergies. Opened from the pause menu
 * ("SKILLS") or the keyboard ('c').
 *
 * Standalone overlay (owns the whole canvas) so it can never collide with the
 * packed HERO sheet layout. Reuses the pick-card icon + tag colours.
 *
 * Interaction: tap a skill to read its description; ◀ / ▶ (or arrow keys) page
 * through deep runs; tap empty space or press ESC to close.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLOR, FONT_DISPLAY, FONT_BODY } from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { computeSynergyMods, skillsById } from '../gameplay/skillSynergy.js';
import { drawSkillIcon, TAG_LABELS, TAG_COLORS } from './SkillPickerUI.js';

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };
const CELL_H = 46;

function hit(rect, x, y) {
  return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export class SkillsModal {
  /** @param {{ content?: object }} deps */
  constructor({ content } = {}) {
    this.content = content || null;
    this.open = false;
    this._page = 0;
    this._selected = null;
    // Layout stashed during render() for handleInput() hit-testing.
    this._cells = [];
    this._prevRect = null;
    this._nextRect = null;
    this._pageCount = 1;
  }

  show(show = true) {
    this.open = !!show;
    this._page = 0;
    this._selected = null;
  }
  hide() { this.open = false; }
  toggle(player) { this.open ? this.hide() : this.show(); void player; }

  handleInput(action) {
    if (!this.open) return false;
    const t = action.type;
    if (t === 'escape' || t === 'menu' || t === 'skills' || t === 'inventory') {
      this.hide();
      return true;
    }
    if (t === 'move' && this._pageCount > 1) {
      if (action.dx === 1) this._page = Math.min(this._pageCount - 1, this._page + 1);
      else if (action.dx === -1) this._page = Math.max(0, this._page - 1);
      return true;
    }
    if (t === 'pointer' || t === 'tap') {
      const { x, y } = action;
      if (hit(this._prevRect, x, y)) { this._page = Math.max(0, this._page - 1); return true; }
      if (hit(this._nextRect, x, y)) { this._page = Math.min(this._pageCount - 1, this._page + 1); return true; }
      for (const c of this._cells) {
        if (hit(c, x, y)) { this._selected = this._selected === c.skill ? null : c.skill; return true; }
      }
      this.hide();
      return true;
    }
    return true; // swallow everything else while open
  }

  render(renderer, player) {
    if (!this.open || !player) return;
    const r = renderer;
    const H = Layout.canvasH || CANVAS_HEIGHT;
    const pool = (this.content?.skills?.skills) || [];
    const byId = skillsById(pool);
    const ownedIds = player.skills || [];
    const owned = ownedIds.map((id) => byId[id]).filter(Boolean);
    const { active } = computeSynergyMods(ownedIds, byId);

    r.drawRect(0, 0, CANVAS_WIDTH, H, 'rgba(0,0,0,0.92)');
    r.drawText('SKILLS', CANVAS_WIDTH / 2, 44,
      { size: 26, bold: true, align: 'center', color: '#d6c87a', family: FONT_DISPLAY });
    r.drawText(`${owned.length} acquired this run`, CANVAS_WIDTH / 2, 72,
      { size: 12, align: 'center', color: COLOR.textMuted, family: FONT_BODY });

    // --- Active synergies ----------------------------------------------
    let y = 96;
    r.drawText('ACTIVE SYNERGIES', 18, y, { size: 10, color: COLOR.textMuted, family: FONT_BODY });
    y += 18;
    if (active.length === 0) {
      r.drawText('None yet — collect 2+ skills of a family.', 18, y,
        { size: 11, color: '#8a8494', family: FONT_BODY });
    } else {
      let chipX = 18;
      for (const a of active) {
        const label = `${TAG_LABELS[a.tag] || a.tag} ${ROMAN[a.tier] || a.tier}`;
        const w = label.length * 7 + 16;
        if (chipX + w > CANVAS_WIDTH - 16) { chipX = 18; y += 22; }
        const col = TAG_COLORS[a.tag] || '#c0c0c8';
        r.drawRect(chipX, y - 2, w, 18, '#16141c');
        r.drawStrokedRect(chipX, y - 2, w, 18, col, 1);
        r.drawText(label, chipX + w / 2, y + 7,
          { size: 10, align: 'center', baseline: 'middle', bold: true, color: col, family: FONT_BODY });
        chipX += w + 8;
      }
    }
    y += 30;
    r.drawRect(14, y - 4, CANVAS_WIDTH - 28, 1, '#2a2630');
    y += 8;

    // --- Paged skill grid (2 columns) ----------------------------------
    // Reserve room at the bottom for the detail strip + close hint.
    const detailY = H - 96;
    const gridBottom = detailY - 12;
    const maxRows = Math.max(1, Math.floor((gridBottom - y) / CELL_H));
    const capacity = maxRows * 2;
    this._pageCount = Math.max(1, Math.ceil(owned.length / capacity));
    if (this._page > this._pageCount - 1) this._page = this._pageCount - 1;
    const start = this._page * capacity;
    const pageItems = owned.slice(start, start + capacity);

    const colW = (CANVAS_WIDTH - 28) / 2;
    this._cells = [];
    for (let i = 0; i < pageItems.length; i++) {
      const s = pageItems[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cxp = 16 + col * colW;
      const cyp = y + row * CELL_H;
      const accent = rarityTint(s.rarity);
      const selected = this._selected === s;
      if (selected) r.drawStrokedRect(cxp - 2, cyp + 1, colW - 8, CELL_H - 4, accent, 1);
      drawSkillIcon(r, cxp, cyp + 4, 32, s, accent);
      const tx = cxp + 40;
      r.drawText(s.name, tx, cyp + 6, { size: 12, bold: true, color: accent, family: FONT_BODY });
      const tags = (s.tags || []).map((t) => TAG_LABELS[t]).filter(Boolean).join(' · ');
      if (tags) r.drawText(tags, tx, cyp + 24, { size: 9, color: '#8a8494', family: FONT_BODY });
      this._cells.push({ x: cxp - 2, y: cyp, w: colW - 8, h: CELL_H, skill: s });
    }
    if (owned.length === 0) {
      r.drawText('No skills yet — level up to choose one.', CANVAS_WIDTH / 2, y + 20,
        { size: 12, align: 'center', color: '#8a8494', family: FONT_BODY });
    }

    // --- Page controls --------------------------------------------------
    this._prevRect = this._nextRect = null;
    if (this._pageCount > 1) {
      const py = gridBottom + 2;
      this._prevRect = { x: 16, y: py - 4, w: 84, h: 24 };
      this._nextRect = { x: CANVAS_WIDTH - 100, y: py - 4, w: 84, h: 24 };
      if (this._page > 0) {
        r.drawText('◀ PREV', this._prevRect.x + 42, py + 8,
          { size: 12, align: 'center', baseline: 'middle', color: COLOR.gold, family: FONT_BODY });
      }
      if (this._page < this._pageCount - 1) {
        r.drawText('NEXT ▶', this._nextRect.x + 42, py + 8,
          { size: 12, align: 'center', baseline: 'middle', color: COLOR.gold, family: FONT_BODY });
      }
      r.drawText(`Page ${this._page + 1} / ${this._pageCount}`, CANVAS_WIDTH / 2, py + 8,
        { size: 11, align: 'center', baseline: 'middle', color: COLOR.textMuted, family: FONT_BODY });
    }

    // --- Selected detail strip -----------------------------------------
    if (this._selected) {
      const s = this._selected;
      const accent = rarityTint(s.rarity);
      r.drawRect(14, detailY, CANVAS_WIDTH - 28, 64, '#14121a');
      r.drawStrokedRect(14, detailY, CANVAS_WIDTH - 28, 64, accent, 1);
      r.drawText(`${s.name}  ·  ${s.rarity}`, 24, detailY + 12,
        { size: 12, bold: true, color: accent, family: FONT_BODY });
      r.drawText(s.description || '', 24, detailY + 34,
        { size: 11, color: COLOR.textPrimary, family: FONT_BODY });
    }

    r.drawText('tap a skill for detail  ·  tap empty space or ESC to close',
      CANVAS_WIDTH / 2, H - 22,
      { size: 10, align: 'center', color: COLOR.goldDim, family: FONT_BODY });
  }
}

function rarityTint(r) {
  switch (r) {
    case 'rare':     return '#5a8ed8';
    case 'uncommon': return '#5ac06a';
    case 'epic':     return '#b070d8';
    default:         return '#c0c0c8';
  }
}

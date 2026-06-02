/**
 * SkillsModal — full-canvas overlay listing the skills acquired this run and
 * the active fury/ward/hunt/arcane synergies. Opened from the pause menu
 * ("SKILLS") or the keyboard ('k'); any tap / ESC closes it.
 *
 * Standalone overlay (owns the whole canvas) so it can never collide with the
 * packed HERO sheet layout. Reuses the pick-card icon + tag colours.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLOR, FONT_DISPLAY, FONT_BODY } from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { computeSynergyMods, skillsById } from '../gameplay/skillSynergy.js';
import { drawSkillIcon, TAG_LABELS, TAG_COLORS } from './SkillPickerUI.js';

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

export class SkillsModal {
  /** @param {{ content?: object }} deps */
  constructor({ content } = {}) {
    this.content = content || null;
    this.open = false;
  }

  show(show = true) { this.open = !!show; }
  hide() { this.open = false; }
  toggle(player) { this.open ? this.hide() : this.show(); void player; }

  handleInput(action) {
    if (!this.open) return false;
    if (action.type === 'escape' || action.type === 'menu'
        || action.type === 'pointer' || action.type === 'tap'
        || action.type === 'inventory') {
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

    // --- Active synergies row -------------------------------------------
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

    // --- Owned skill grid (2 columns) -----------------------------------
    r.drawRect(14, y - 4, CANVAS_WIDTH - 28, 1, '#2a2630');
    y += 8;
    const colW = (CANVAS_WIDTH - 28) / 2;
    const cellH = 46;
    const maxRows = Math.floor((H - y - 40) / cellH);
    const capacity = maxRows * 2;
    const shown = Math.min(owned.length, capacity);
    for (let i = 0; i < shown; i++) {
      const s = owned[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cxp = 16 + col * colW;
      const cyp = y + row * cellH;
      const accent = rarityTint(s.rarity);
      drawSkillIcon(r, cxp, cyp + 4, 32, s, accent);
      const tx = cxp + 40;
      r.drawText(s.name, tx, cyp + 6, { size: 12, bold: true, color: accent, family: FONT_BODY });
      const tags = (s.tags || []).map((t) => TAG_LABELS[t]).filter(Boolean).join(' · ');
      if (tags) r.drawText(tags, tx, cyp + 24, { size: 9, color: '#8a8494', family: FONT_BODY });
    }
    if (owned.length > shown) {
      r.drawText(`+${owned.length - shown} more`, CANVAS_WIDTH / 2, y + maxRows * cellH + 4,
        { size: 11, align: 'center', color: COLOR.textMuted, family: FONT_BODY });
    }
    if (owned.length === 0) {
      r.drawText('No skills yet — level up to choose one.', CANVAS_WIDTH / 2, y + 20,
        { size: 12, align: 'center', color: '#8a8494', family: FONT_BODY });
    }

    r.drawText('tap anywhere or press ESC to close', CANVAS_WIDTH / 2, H - 24,
      { size: 11, align: 'center', color: COLOR.goldDim, family: FONT_BODY });
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

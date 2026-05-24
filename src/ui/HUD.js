/**
 * HUD — top stats strip + small floor tag + bottom-left messages.
 *
 * Layout is tuned for 480×800 portrait canvas. World view fills middle of
 * screen; HUD lives in two strips: top (stats) and just-above-d-pad
 * (messages). Hotkey bar is OMITTED on mobile — players use the inventory
 * modal via the BAG button. Number-key hotkeys (1–9) still work on
 * desktop because KeyboardHandler maps them; HUD just doesn't draw the bar.
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants.js';

const TOP_PAD = 8;
// Reserve bottom area for the DOM-overlayed action button row (WAIT/PICK/
// DOWN/BAG). The row is ~52 px tall + 12 px padding; we leave a little
// extra so the message strip never visually touches the buttons.
const BOTTOM_RESERVED = 88;

export class HUD {
  /** @param {{ messageLog: object }} deps */
  constructor({ messageLog }) {
    this.messageLog = messageLog;
  }

  /**
   * @param {import('../rendering/Renderer.js').Renderer} renderer
   * @param {{ player:object, floor:object, floorIndex:number, totalFloors:number }} ctx
   */
  render(renderer, ctx) {
    const { player, floor, floorIndex, totalFloors } = ctx;
    this._drawTopStrip(renderer, player, floor, floorIndex, totalFloors);
    this._drawMessages(renderer);
  }

  _drawTopStrip(r, p, floor, floorIndex, totalFloors) {
    // Background strip so text stays readable against bright tiles.
    r.drawRect(0, 0, CANVAS_WIDTH, 86, 'rgba(6,6,10,0.78)');

    // HP bar — full width minus padding.
    const barW = CANVAS_WIDTH - 16;
    r.drawBar(8, TOP_PAD, barW, 16, p.stats.hp, p.stats.hpMax, COLOR.hpBar, COLOR.hpBarBg);
    r.drawText(`HP ${p.stats.hp}/${p.stats.hpMax}`, 12, TOP_PAD + 2, { size: 12, bold: true });

    // XP bar just below.
    const xpNeed = p.xpToNext();
    r.drawBar(8, TOP_PAD + 20, barW, 8, p.xp, xpNeed, COLOR.xpBar, COLOR.xpBarBg);
    r.drawText(`Lv ${p.level}`, 12, TOP_PAD + 20, { size: 9, bold: true });
    r.drawText(`${p.xp}/${xpNeed} XP`, CANVAS_WIDTH - 12, TOP_PAD + 20,
      { size: 9, bold: true, align: 'right' });

    // Stats line.
    const atk = p.totalAtk();
    const def = p.totalDef();
    const crit = Math.round(p.critChance() * 100);
    r.drawText(`ATK ${atk}  DEF ${def}  DEX ${p.stats.dex}  CRIT ${crit}%`,
      8, TOP_PAD + 34, { size: 11, color: COLOR.textMuted });
    r.drawText(`◈ ${p.gold}`, CANVAS_WIDTH - 12, TOP_PAD + 34,
      { size: 11, color: COLOR.textXP, align: 'right' });

    // Floor tag.
    if (floor) {
      const name = `F${floorIndex + 1}/${totalFloors}  ${floor.definition.name}`;
      r.drawText(name, CANVAS_WIDTH / 2, TOP_PAD + 50,
        { size: 11, align: 'center', color: COLOR.textPrimary });
    }

    // Status effect chips (tight row).
    let chipX = 8;
    const chipY = TOP_PAD + 66;
    for (const eff of p.statusEffects) {
      const label = `${eff.id} ${eff.value}×${eff.duration}`;
      const w = 8 + label.length * 6;
      const bg = eff.id === 'poison' ? '#2a4a30'
              : (eff.id === 'atk_buff' ? '#4a2a20' : '#1e3a52');
      r.drawRect(chipX, chipY, w, 14, bg);
      r.drawText(label, chipX + 4, chipY + 1, { size: 10 });
      chipX += w + 4;
      if (chipX > CANVAS_WIDTH - 80) break; // wrap-safe — drop the rest
    }
    // Revive indicator on the right.
    if (p.reviveCharges > 0) {
      r.drawText(`✦ Revive ×${p.reviveCharges}`, CANVAS_WIDTH - 12, chipY + 1,
        { size: 11, color: COLOR.textHeal, align: 'right' });
    }
  }

  _drawMessages(r) {
    if (!this.messageLog) return;
    const lines = this.messageLog.recentWithFade
      ? this.messageLog.recentWithFade(3)
      : this.messageLog.recent(3).map((m) => ({ ...m, alpha: 1 }));
    if (lines.length === 0) return;
    // Sit just above the reserved bottom band. Each line carries its own
    // alpha (faded older messages) so the strip stops blocking the world
    // a few seconds after the action that triggered it.
    const baseY = CANVAS_HEIGHT - BOTTOM_RESERVED - 8 - lines.length * 16;
    const ctx = r.ctx;
    // Strip background tinted by the most-opaque line so it dims away with
    // the text instead of staying as a permanent dark bar.
    const maxAlpha = Math.max(...lines.map((l) => l.alpha));
    ctx.save();
    ctx.globalAlpha = 0.72 * maxAlpha;
    r.drawRect(0, baseY - 4, CANVAS_WIDTH, lines.length * 16 + 8, '#06060a');
    ctx.restore();
    for (let i = 0; i < lines.length; i++) {
      ctx.save();
      ctx.globalAlpha = lines[i].alpha;
      r.drawText(lines[i].text, 8, baseY + i * 16,
        { size: 11, color: lines[i].color });
      ctx.restore();
    }
  }
}

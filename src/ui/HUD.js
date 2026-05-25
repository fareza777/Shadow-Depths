/**
 * HUD — top stats strip + small floor tag + bottom-left messages.
 *
 * Layout is tuned for 480×800 portrait canvas. World view fills middle of
 * screen; HUD lives in two strips: top (stats) and just-above-d-pad
 * (messages). Hotkey bar is OMITTED on mobile — players use the inventory
 * modal via the BAG button. Quick-use bar (1–3) sits in the control band;
 * keys 1–3 use potions, 4–9 map to bag slots 4–9 on desktop.
 */
import { COLOR, FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize } from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';

const TOP_PAD = 10;

export class HUD {
  /** @param {{ messageLog: object }} deps */
  constructor({ messageLog }) {
    this.messageLog = messageLog;
  }

  /**
   * @param {import('../rendering/Renderer.js').Renderer} renderer
   * @param {{ player:object, floor:object, floorIndex:number, totalFloors:number, mode?:string }} ctx
   */
  render(renderer, ctx) {
    const { player, floor, floorIndex, totalFloors, mode } = ctx;
    this._drawTopStrip(renderer, player, floor, floorIndex, totalFloors, mode);
    this._drawMessages(renderer);
  }

  _drawTopStrip(r, p, floor, floorIndex, totalFloors, mode) {
    // Solid background — the world rendering is now clipped out of this
    // band, so we don't need rgba; opaque looks cleaner and contrasts
    // well with the world view that sits just below.
    r.drawRect(0, 0, Layout.canvasW, Layout.hud, COLOR.bgPanel);
    r.drawRect(0, Layout.hud - 1, Layout.canvasW, 1, COLOR.gold);

    const barW = Layout.canvasW - 16;
    r.drawBar(8, TOP_PAD, barW, 18, p.stats.hp, p.stats.hpMax, COLOR.hpBar, COLOR.hpBarBg);
    r.drawText(`HP ${p.stats.hp}/${p.stats.hpMax}`, 12, TOP_PAD + 2,
      { size: uiSize(13), bold: true, family: FONT_MONO });

    const xpNeed = p.xpToNext();
    const xpMaxed = !Number.isFinite(xpNeed);
    const xpY = TOP_PAD + 22;
    r.drawRect(8, xpY - 2, 74, 16, COLOR.bgCardHi);
    r.drawStrokedRect(8, xpY - 2, 74, 16, COLOR.gold, 1);
    r.drawText(`LEVEL ${p.level}`, 45, xpY + 6,
      { size: uiSize(11), bold: true, align: 'center', baseline: 'middle',
        family: FONT_MONO, color: COLOR.textPrimary });
    r.drawBar(88, xpY, Layout.canvasW - 96, 10, xpMaxed ? 1 : p.xp, xpMaxed ? 1 : xpNeed, COLOR.xpBar, COLOR.xpBarBg);
    r.drawText(xpMaxed ? 'MAX XP' : `${p.xp}/${xpNeed} XP`, Layout.canvasW - 12, xpY,
      { size: uiSize(11), bold: true, align: 'right', family: FONT_MONO });

    const atk = p.totalAtk();
    const def = p.totalDef();
    const crit = Math.round(p.critChance() * 100);
    const range = p.weapon?.stats?.attackRange || 1;
    const rangeChip = range > 1 ? `  RNG ${range}` : '';
    r.drawText(`ATK ${atk}  DEF ${def}  CRIT ${crit}%${rangeChip}`,
      8, TOP_PAD + 38, { size: uiSize(12), color: COLOR.textMuted, family: FONT_MONO });
    r.drawText(`◈ ${p.gold}`, Layout.canvasW - 12, TOP_PAD + 38,
      { size: uiSize(12), color: COLOR.textXP, align: 'right', family: FONT_MONO });

    if (floor) {
      const name = `${floor.definition.name}`;
      const sub = `FLOOR ${floorIndex + 1} OF ${totalFloors}`;
      r.drawText(name, Layout.canvasW / 2, TOP_PAD + 56,
        { size: uiSize(13), bold: true, align: 'center', color: COLOR.gold, family: FONT_DISPLAY });
      r.drawText(sub, Layout.canvasW / 2, TOP_PAD + 74,
        { size: uiSize(11), bold: true, align: 'center', color: COLOR.textMuted, family: FONT_MONO });
      if (mode === 'daily') {
        r.drawText('☼ DAILY', Layout.canvasW - 12, TOP_PAD + 58,
          { size: uiSize(11), bold: true, align: 'right', color: COLOR.textXP, family: FONT_MONO });
      }
    }

    let chipX = 8;
    const chipY = TOP_PAD + 82;
    for (const eff of p.statusEffects) {
      const label = `${eff.id} ${eff.value}×${eff.duration}`;
      const w = 8 + label.length * 6;
      const bg = eff.id === 'poison' ? '#2a4a30'
              : (eff.id === 'atk_buff' ? '#4a2a20' : '#1e3a52');
      r.drawRect(chipX, chipY, w, 14, bg);
      r.drawText(label, chipX + 4, chipY + 1, { size: uiSize(11) });
      chipX += w + 4;
      if (chipX > Layout.canvasW - 80) break;
    }
    if (p.reviveCharges > 0) {
      r.drawText(`✦ Revive ×${p.reviveCharges}`, Layout.canvasW - 12, chipY + 1,
        { size: uiSize(12), color: COLOR.textHeal, align: 'right' });
    }
    // Skill chips — appear under status chips when the player has skills.
    // Compact: 4-char abbreviation per skill so multiple fit on one row.
    if (p.skills && p.skills.length > 0) {
      let sx = 8;
      const sy = chipY + 18;
      r.drawText('SK', sx, sy + 1, { size: uiSize(10), color: COLOR.textMuted });
      sx += 16;
      for (const id of p.skills) {
        const abbr = HUD._skillAbbr(id);
        const w = 6 + abbr.length * 6;
        r.drawRect(sx, sy, w, 14, '#1e2a3a');
        r.drawText(abbr, sx + 3, sy + 1, { size: uiSize(11), color: '#a0d0ff' });
        sx += w + 3;
        if (sx > Layout.canvasW - 8) break;
      }
    }
  }

  static _skillAbbr(id) {
    const map = {
      hardened:   'HRD',
      sharpened:  'SHP',
      tempered:   'TMP',
      quickened:  'QCK',
      eager:      'BAG',
      studious:   'XP+',
      bloodthirst:'LFS',
      stout:      'STT',
      long_reach: 'RNG',
      second_wind:'REG'
    };
    return map[id] || id.slice(0, 3).toUpperCase();
  }

  _drawMessages(r) {
    if (!this.messageLog) return;
    const lines = this.messageLog.recentWithFade
      ? this.messageLog.recentWithFade(3)
      : this.messageLog.recent(3).map((m) => ({ ...m, alpha: 1 }));
    if (lines.length === 0) return;
    // Float just below the HUD strip, at the top of the world viewport.
    // Each line carries its own alpha so the band dissolves a few seconds
    // after the action that produced it — never permanently blocks view.
    const baseY = Layout.hud + 4;
    const ctx = r.ctx;
    const maxAlpha = Math.max(...lines.map((l) => l.alpha));
    ctx.save();
    ctx.globalAlpha = 0.72 * maxAlpha;
    r.drawRect(0, baseY, Layout.canvasW, lines.length * 18 + 8, '#06060a');
    ctx.restore();
    for (let i = 0; i < lines.length; i++) {
      ctx.save();
      ctx.globalAlpha = lines[i].alpha;
      r.drawText(lines[i].text, 8, baseY + 4 + i * 18,
        { size: uiSize(13), color: lines[i].color, family: FONT_BODY });
      ctx.restore();
    }
  }
}

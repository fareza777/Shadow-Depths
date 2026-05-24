/**
 * HUD — top stats strip + small floor tag + bottom-left messages.
 *
 * Layout is tuned for 480×800 portrait canvas. World view fills middle of
 * screen; HUD lives in two strips: top (stats) and just-above-d-pad
 * (messages). Hotkey bar is OMITTED on mobile — players use the inventory
 * modal via the BAG button. Number-key hotkeys (1–9) still work on
 * desktop because KeyboardHandler maps them; HUD just doesn't draw the bar.
 */
import {
  COLOR, CANVAS_WIDTH, HUD_HEIGHT, FONT_DISPLAY, FONT_BODY, FONT_MONO
} from '../config/constants.js';

const TOP_PAD = 8;

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
    // Solid background — the world rendering is now clipped out of this
    // band, so we don't need rgba; opaque looks cleaner and contrasts
    // well with the world view that sits just below.
    r.drawRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT, COLOR.bgPanel);
    r.drawRect(0, HUD_HEIGHT - 1, CANVAS_WIDTH, 1, COLOR.gold);

    // HP bar — full width minus padding.
    const barW = CANVAS_WIDTH - 16;
    r.drawBar(8, TOP_PAD, barW, 16, p.stats.hp, p.stats.hpMax, COLOR.hpBar, COLOR.hpBarBg);
    r.drawText(`HP ${p.stats.hp}/${p.stats.hpMax}`, 12, TOP_PAD + 2,
      { size: 12, bold: true, family: FONT_MONO });

    // XP bar just below.
    const xpNeed = p.xpToNext();
    r.drawBar(8, TOP_PAD + 20, barW, 8, p.xp, xpNeed, COLOR.xpBar, COLOR.xpBarBg);
    r.drawText(`Lv ${p.level}`, 12, TOP_PAD + 20,
      { size: 9, bold: true, family: FONT_MONO });
    r.drawText(`${p.xp}/${xpNeed} XP`, CANVAS_WIDTH - 12, TOP_PAD + 20,
      { size: 9, bold: true, align: 'right', family: FONT_MONO });

    // Stats line.
    const atk = p.totalAtk();
    const def = p.totalDef();
    const crit = Math.round(p.critChance() * 100);
    const range = p.weapon?.stats?.attackRange || 1;
    const rangeChip = range > 1 ? `  RNG ${range}` : '';
    r.drawText(`ATK ${atk}  DEF ${def}  CRIT ${crit}%${rangeChip}`,
      8, TOP_PAD + 34, { size: 11, color: COLOR.textMuted, family: FONT_MONO });
    r.drawText(`◈ ${p.gold}`, CANVAS_WIDTH - 12, TOP_PAD + 34,
      { size: 11, color: COLOR.textXP, align: 'right', family: FONT_MONO });

    // Floor tag — atmospheric italic flavor.
    if (floor) {
      const name = `${floor.definition.name}`;
      const sub = `floor ${floorIndex + 1} / ${totalFloors}`;
      r.drawText(name, CANVAS_WIDTH / 2, TOP_PAD + 50,
        { size: 12, bold: true, align: 'center', color: COLOR.gold, family: FONT_DISPLAY });
      r.drawText(sub, CANVAS_WIDTH / 2, TOP_PAD + 64,
        { size: 9, italic: true, align: 'center', color: COLOR.textMuted, family: FONT_BODY });
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
      if (chipX > CANVAS_WIDTH - 80) break;
    }
    if (p.reviveCharges > 0) {
      r.drawText(`✦ Revive ×${p.reviveCharges}`, CANVAS_WIDTH - 12, chipY + 1,
        { size: 11, color: COLOR.textHeal, align: 'right' });
    }
    // Skill chips — appear under status chips when the player has skills.
    // Compact: 4-char abbreviation per skill so multiple fit on one row.
    if (p.skills && p.skills.length > 0) {
      let sx = 8;
      const sy = chipY + 18;
      r.drawText('SK', sx, sy + 1, { size: 9, color: COLOR.textMuted });
      sx += 16;
      for (const id of p.skills) {
        const abbr = HUD._skillAbbr(id);
        const w = 6 + abbr.length * 6;
        r.drawRect(sx, sy, w, 14, '#1e2a3a');
        r.drawText(abbr, sx + 3, sy + 1, { size: 10, color: '#a0d0ff' });
        sx += w + 3;
        if (sx > CANVAS_WIDTH - 8) break;
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
    const baseY = HUD_HEIGHT + 4;
    const ctx = r.ctx;
    const maxAlpha = Math.max(...lines.map((l) => l.alpha));
    ctx.save();
    ctx.globalAlpha = 0.72 * maxAlpha;
    r.drawRect(0, baseY, CANVAS_WIDTH, lines.length * 16 + 8, '#06060a');
    ctx.restore();
    for (let i = 0; i < lines.length; i++) {
      ctx.save();
      ctx.globalAlpha = lines[i].alpha;
      r.drawText(lines[i].text, 8, baseY + 4 + i * 16,
        { size: 11, color: lines[i].color });
      ctx.restore();
    }
  }
}

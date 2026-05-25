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
    const { player, floor, floorIndex, totalFloors, mode, suppressMessages } = ctx;
    this._drawTopStrip(renderer, player, floor, floorIndex, totalFloors, mode);
    if (!suppressMessages) this._drawMessages(renderer);
  }

  _drawTopStrip(r, p, floor, floorIndex, totalFloors, mode) {
    const ctx = r.ctx;
    r.drawRect(0, 0, Layout.canvasW, Layout.hud, COLOR.bgPanel);
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, Layout.hud);
    g.addColorStop(0, '#302536');
    g.addColorStop(0.46, '#1f1926');
    g.addColorStop(1, '#120f18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Layout.canvasW, Layout.hud);
    ctx.globalAlpha = 0.18;
    for (let x = 10; x < Layout.canvasW; x += 42) {
      r.drawRect(x, 4, 18, 1, COLOR.goldDim);
      r.drawRect(x + 9, 94, 28, 1, '#ffffff22');
    }
    ctx.restore();
    r.drawRect(0, Layout.hud - 1, Layout.canvasW, 1, COLOR.gold);

    const barW = Layout.canvasW - 16;
    this._drawFramedBar(r, 8, TOP_PAD, barW, 18, p.stats.hp, p.stats.hpMax,
      COLOR.hpBar, COLOR.hpBarBg, 'HP');
    r.drawText(`${p.stats.hp}/${p.stats.hpMax}`, 36, TOP_PAD + 2,
      { size: uiSize(13), bold: true, family: FONT_MONO });

    const xpNeed = p.xpToNext();
    const xpMaxed = !Number.isFinite(xpNeed);
    const xpY = TOP_PAD + 22;
    r.drawRect(8, xpY - 2, 74, 16, COLOR.bgCardHi);
    r.drawStrokedRect(8, xpY - 2, 74, 16, COLOR.gold, 1);
    r.drawText(`LEVEL ${p.level}`, 45, xpY + 6,
      { size: uiSize(11), bold: true, align: 'center', baseline: 'middle',
        family: FONT_MONO, color: COLOR.textPrimary });
    this._drawFramedBar(r, 88, xpY, Layout.canvasW - 96, 10,
      xpMaxed ? 1 : p.xp, xpMaxed ? 1 : xpNeed, COLOR.xpBar, COLOR.xpBarBg, '');
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
      this._drawFloorChip(r, floor, floorIndex);
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

  _drawFramedBar(r, x, y, w, h, value, max, fill, bg, label) {
    r.drawRect(x - 2, y - 2, w + 4, h + 4, '#08050a');
    r.drawBar(x, y, w, h, value, max, fill, bg);
    r.drawRect(x + 2, y + 2, w - 4, 2, '#ffffff28');
    if (label) {
      r.drawRect(x, y, 24, h, '#00000044');
      r.drawText(label, x + 4, y + 2, { size: uiSize(10), bold: true, family: FONT_MONO });
    }
  }

  _drawFloorChip(r, floor, floorIndex) {
    const special = floor?.definition?.specialEnemyId || '';
    const y = TOP_PAD + 72;
    if ((floorIndex + 1) % 20 === 0) {
      r.drawRect(8, y, 62, 16, '#0a1018');
      r.drawStrokedRect(8, y, 62, 16, '#80b0e0', 1);
      r.drawText('BIOME', 39, y + 2, {
        size: uiSize(9), bold: true, align: 'center', family: FONT_MONO, color: '#80b0e0'
      });
    }
    if (!special) return;
    const boss = special.startsWith('boss_');
    const text = boss ? 'BOSS' : 'ELITE';
    const col = boss ? COLOR.gold : '#c080ff';
    const x = boss ? Layout.canvasW - 74 : Layout.canvasW - 78;
    r.drawRect(x, y, 66, 16, '#09060c');
    r.drawStrokedRect(x, y, 66, 16, col, 1);
    r.drawText(text, x + 33, y + 2, {
      size: uiSize(9), bold: true, align: 'center',
      family: FONT_MONO, color: col
    });
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

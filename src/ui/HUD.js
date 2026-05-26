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
import { IRON } from './ironHud.js';

const BRASS_DARK = '#7a5c2c';
const BRASS = '#d4ac6c';
const BRASS_HI = '#f1d49a';
const BRASS_WHITE = '#fff5d0';

function hudNow() {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

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
      this._drawFloorBanner(r, name, floorIndex, totalFloors);
      if (mode === 'daily') {
        r.drawText('☼ DAILY', Layout.canvasW - 22, TOP_PAD + 84,
          { size: uiSize(11), bold: true, align: 'right', color: BRASS_HI, family: FONT_MONO });
      }
      this._drawFloorChip(r, floor, floorIndex);
      this._drawDepthMeter(r, floorIndex, totalFloors);
    }

    let chipX = 8;
    const chipY = TOP_PAD + 84;
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

  /**
   * Brass-engraved floor banner — matches iron-title-hud.jsx reference.
   * Dark plate with brass border, animated shimmer sweeping across the
   * floor name, "FLOOR N OF M" subtitle wrapped between brass hairlines.
   */
  _drawFloorBanner(r, name, floorIndex, totalFloors) {
    const ctx = r.ctx;
    const x = 8;
    const y = TOP_PAD + 52;
    const w = Layout.canvasW - 32;
    const h = 30;
    const t = hudNow();

    // Background plate
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, IRON.plate0);
    g.addColorStop(1, IRON.ink);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // Brass border
    ctx.strokeStyle = `${BRASS_DARK}cc`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // Top bevel + bottom shadow
    ctx.fillStyle = `${IRON.plateHi}88`;
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillStyle = IRON.ink;
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);

    // Gilt shimmer sweep — moves L→R across the banner.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, w - 2, h - 2);
    ctx.clip();
    const sweepPhase = ((t * 0.22) % 1);
    const sweepX = x - w * 0.4 + sweepPhase * w * 1.8;
    const sweepG = ctx.createLinearGradient(sweepX, 0, sweepX + w * 0.45, 0);
    sweepG.addColorStop(0,    'rgba(212,172,108,0)');
    sweepG.addColorStop(0.5,  'rgba(212,172,108,0.22)');
    sweepG.addColorStop(1,    'rgba(212,172,108,0)');
    ctx.fillStyle = sweepG;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Floor name with brass-shimmer gradient.
    ctx.font = `bold ${uiSize(13)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = Layout.canvasW / 2;
    const labelY = y + 11;
    // Engraved back-shadow
    ctx.fillStyle = IRON.ink;
    ctx.fillText(name.toUpperCase(), cx + 1, labelY + 1);
    // Brass body
    ctx.fillStyle = BRASS_DARK;
    ctx.fillText(name.toUpperCase(), cx, labelY);
    // Sliding bright band on top
    const tw = ctx.measureText(name.toUpperCase()).width;
    const phase = (t * 0.18) % 1;
    const gx = cx - tw / 2 - tw * 0.3 + phase * tw * 1.6;
    const tg = ctx.createLinearGradient(gx, 0, gx + tw * 0.6, 0);
    tg.addColorStop(0,    BRASS_DARK);
    tg.addColorStop(0.4,  BRASS_HI);
    tg.addColorStop(0.5,  BRASS_WHITE);
    tg.addColorStop(0.6,  BRASS_HI);
    tg.addColorStop(1,    BRASS_DARK);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tg;
    ctx.fillRect(x, labelY - 10, w, 20);
    ctx.restore();

    // Subtitle: ── FLOOR N OF M ──
    const subY = y + h - 6;
    const sub = `FLOOR ${floorIndex + 1} OF ${totalFloors}`;
    ctx.font = `${uiSize(9)}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = IRON.boneDim;
    ctx.fillText(sub, cx, subY);
    const subW = ctx.measureText(sub).width;
    // Brass hairlines either side.
    const lineY = subY;
    const lineL = cx - subW / 2 - 8;
    const lineR = cx + subW / 2 + 8;
    const lineLen = 50;
    const lg1 = ctx.createLinearGradient(lineL - lineLen, 0, lineL, 0);
    lg1.addColorStop(0, 'rgba(212,172,108,0)');
    lg1.addColorStop(1, BRASS);
    ctx.fillStyle = lg1;
    ctx.fillRect(lineL - lineLen, lineY, lineLen, 1);
    const lg2 = ctx.createLinearGradient(lineR, 0, lineR + lineLen, 0);
    lg2.addColorStop(0, BRASS);
    lg2.addColorStop(1, 'rgba(212,172,108,0)');
    ctx.fillStyle = lg2;
    ctx.fillRect(lineR, lineY, lineLen, 1);

    ctx.restore();
  }

  _drawFloorChip(r, floor, floorIndex) {
    const special = floor?.definition?.specialEnemyId || '';
    const y = TOP_PAD + 84;
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

  _drawDepthMeter(r, floorIndex, totalFloors) {
    const x = Layout.canvasW - 18;
    const y = TOP_PAD + 84;
    const h = 14;
    const pct = Math.max(0, Math.min(1, (floorIndex + 1) / Math.max(1, totalFloors)));
    r.drawRect(x, y, 6, h, '#0a0810');
    r.drawStrokedRect(x, y, 6, h, COLOR.goldDim, 1);
    r.drawRect(x + 2, y + 2 + (h - 4) * (1 - pct), 2, (h - 4) * pct, COLOR.gold);
    for (let i = 1; i < 10; i++) {
      const ty = y + Math.round((h - 2) * (i / 10));
      r.drawRect(x - (i % 5 === 0 ? 5 : 3), ty, i % 5 === 0 ? 4 : 2, 1, COLOR.goldDim);
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

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
    const topKey = HUD._topStripCacheKey(player, floor, floorIndex, totalFloors, mode);
    if (topKey && typeof renderer.drawCachedScreenRegion === 'function') {
      renderer.drawCachedScreenRegion(topKey, { x: 0, y: 0, w: Layout.canvasW, h: Layout.hud }, () => {
        this._drawTopStrip(renderer, player, floor, floorIndex, totalFloors, mode);
      });
    } else {
      this._drawTopStrip(renderer, player, floor, floorIndex, totalFloors, mode);
    }
    if (!suppressMessages) this._drawMessages(renderer);
  }

  static _topStripCacheKey(p, floor, floorIndex, totalFloors, mode) {
    if (!p) return null;
    const xpNeed = p.xpToNext();
    const statParts = [
      p.totalAtk(), p.totalDef(), Math.round(p.critChance() * 100),
      p.weapon?.stats?.attackRange || 1,
      p.rangedFocus ?? 0, p.rangedFocusMax ?? 0
    ].join(',');
    const statuses = (p.statusEffects || [])
      .map((s) => `${s.id}:${s.value ?? ''}:${s.duration ?? ''}`).join(',');
    const skills = (p.skills || []).join(',');
    const def = floor?.definition || {};
    return [
      'hud-top',
      Layout.canvasW, Layout.hud,
      p.stats.hp, p.stats.hpMax,
      p.xp, Number.isFinite(xpNeed) ? xpNeed : 'max',
      p.level, p.gold, p.reviveCharges,
      statParts, statuses, skills,
      floorIndex, totalFloors, mode || '',
      def.name || '', def.type || '', def.specialEnemyId || ''
    ].join('|');
  }

  _drawTopStrip(r, p, floor, floorIndex, totalFloors, mode) {
    const ctx = r.ctx;
    r.drawRect(0, 0, Layout.canvasW, Layout.hud, COLOR.bgPanel);
    ctx.save();
    // Static panel gradient — depends only on Layout.hud, so build it once and
    // reuse instead of allocating a CanvasGradient every frame.
    if (!this._bgGrad || this._bgGradH !== Layout.hud) {
      const g = ctx.createLinearGradient(0, 0, 0, Layout.hud);
      g.addColorStop(0, '#302536');
      g.addColorStop(0.46, '#1f1926');
      g.addColorStop(1, '#120f18');
      this._bgGrad = g;
      this._bgGradH = Layout.hud;
    }
    ctx.fillStyle = this._bgGrad;
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
    const statParts = [`ATK ${atk}`, `DEF ${def}`, `CRIT ${crit}%`];
    if (range > 1) {
      statParts.push(`RNG ${range}`);
      statParts.push(`FOC ${p.rangedFocus ?? 0}/${p.rangedFocusMax ?? 3}`);
    }
    const statY = TOP_PAD + 40;
    const goldReserve = 22;
    r.drawRect(6, statY - 2, Layout.canvasW - 12 - goldReserve, 15, 'rgba(8,6,12,0.92)');
    r.drawText(statParts.join('  '), 8, statY,
      { size: uiSize(11), color: COLOR.textMuted, family: FONT_MONO });
    this._drawGoldBadge(r, p.gold, statY, goldReserve);

    if (floor) {
      const name = `${floor.definition.name}`;
      this._drawFloorBanner(r, name, floorIndex, totalFloors,
        mode === 'daily', floor.definition.type || null);
      this._drawFloorChip(r, floor, floorIndex);
      this._drawDepthMeter(r, floorIndex, totalFloors);
    }

    const chipY = TOP_PAD + 110;
    const chipH = 15;
    let chipX = 8;
    if (floor && (floorIndex + 1) % 20 === 0) {
      const bw = 58;
      r.drawRect(8, chipY, bw, chipH, '#0a1018');
      r.drawStrokedRect(8, chipY, bw, chipH, '#80b0e0', 1);
      r.drawText('BIOME', 8 + bw / 2, chipY + 7, {
        size: uiSize(9), bold: true, align: 'center', baseline: 'middle',
        family: FONT_MONO, color: '#80b0e0'
      });
      chipX = 8 + bw + 6;
    }

    const reviveResv = p.reviveCharges > 0 ? 88 : 0;
    const bossResv = floor?.definition?.specialEnemyId ? 72 : 0;
    const rightLimit = Layout.canvasW - 14 - reviveResv - bossResv;

    for (const eff of p.statusEffects) {
      const label = HUD._statusLabel(eff);
      const w = Math.min(120, 10 + label.length * 6);
      if (chipX + w > rightLimit) break;
      const bg = eff.id === 'poison' ? '#2a4a30'
              : (eff.id === 'atk_buff' ? '#4a2a20' : '#1e3a52');
      r.drawRect(chipX, chipY, w, chipH, bg);
      r.drawStrokedRect(chipX, chipY, w, chipH, COLOR.goldDim, 1);
      r.drawText(label, chipX + 5, chipY + 2,
        { size: uiSize(10), bold: true, family: FONT_MONO, color: COLOR.textPrimary });
      chipX += w + 4;
    }

    if (p.reviveCharges > 0) {
      const label = `REV ${p.reviveCharges}`;
      const rw = Math.max(52, 10 + label.length * 6);
      const rx = Layout.canvasW - rw - 14;
      r.drawRect(rx, chipY, rw, chipH, '#1a2a1a');
      r.drawStrokedRect(rx, chipY, rw, chipH, COLOR.textHeal, 1);
      r.drawText(label, rx + 5, chipY + 2,
        { size: uiSize(10), bold: true, color: COLOR.textHeal, family: FONT_MONO });
    }

    if (p.skills && p.skills.length > 0) {
      const sy = chipY + chipH + 4;
      if (sy + chipH <= Layout.hud - 2) {
        let sx = 8;
        r.drawRect(sx, sy, 22, chipH, '#141018');
        r.drawText('SK', sx + 11, sy + 7,
          { size: uiSize(9), bold: true, align: 'center', baseline: 'middle',
            family: FONT_MONO, color: COLOR.textMuted });
        sx += 26;
        const skillLimit = Layout.canvasW - 14 - bossResv;
        for (const id of p.skills) {
          const abbr = HUD._skillAbbr(id);
          const w = 8 + abbr.length * 6;
          if (sx + w > skillLimit) break;
          r.drawRect(sx, sy, w, chipH, '#1e2a3a');
          r.drawStrokedRect(sx, sy, w, chipH, '#4a6080', 1);
          r.drawText(abbr, sx + 4, sy + 2,
            { size: uiSize(10), bold: true, family: FONT_MONO, color: '#b8d8ff' });
          sx += w + 3;
        }
      }
    }
  }

  static _statusLabel(eff) {
    if (eff.id === 'poison') return `POISON ${eff.value}x${eff.duration}`;
    if (eff.id === 'atk_buff') return `ATK +${eff.value} ${eff.duration}T`;
    if (eff.id === 'def_buff') return `DEF +${eff.value} ${eff.duration}T`;
    return `${eff.id.toUpperCase()} ${eff.duration}T`;
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
  /**
   * Engraved floor nameplate — no box border, only brass piping above &
   * below the title with a hammered inset plate behind the name. Matches
   * the iron-portcullis vocabulary used elsewhere in the HUD.
   */
  _drawGoldBadge(r, gold, statY, rightReserve) {
    const label = `◈ ${gold}`;
    const opts = { size: uiSize(12), color: COLOR.textXP, family: FONT_MONO, bold: true };
    const tw = r.measureText(label, opts);
    const padX = 8;
    const pillW = tw + padX * 2;
    const pillH = 15;
    const pillX = Layout.canvasW - rightReserve - pillW;
    const pillY = statY - 2;
    r.drawRect(pillX, pillY, pillW, pillH, 'rgba(12,10,18,0.95)');
    r.drawStrokedRect(pillX, pillY, pillW, pillH, COLOR.goldDim, 1);
    r.drawText(label, pillX + pillW - padX, statY, { ...opts, align: 'right' });
  }

  _drawFloorBanner(r, name, floorIndex, totalFloors, daily = false, floorType = null) {
    const ctx = r.ctx;
    const x = 8;
    const y = TOP_PAD + 58;
    const w = Layout.canvasW - 32;
    const tag = floorType === 'rest'  ? '✜ REST'
              : floorType === 'forge' ? '⚒ FORGE'
              : floorType === 'vault' ? '◈ VAULT'
              : '';
    const badgeRow = daily || tag;
    const h = badgeRow ? 50 : 42;
    const t = hudNow();
    const cx = Layout.canvasW / 2;
    const upper = name.toUpperCase();

    ctx.save();

    // Hammered inset plate (subtle — sits flush with the HUD bg).
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(8,6,12,0.55)');
    g.addColorStop(0.5, 'rgba(20,16,28,0.30)');
    g.addColorStop(1, 'rgba(8,6,12,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    const labelY = y + 14;
    const floorSubY = badgeRow ? y + 25 : y + 27;
    const pipeBot = badgeRow ? y + 32 : y + h - 5;
    const badgeSubY = y + 40;

    const drawBrassPipe = (py) => {
      const lg = ctx.createLinearGradient(x, py, x + w, py);
      lg.addColorStop(0,    'rgba(212,172,108,0)');
      lg.addColorStop(0.18, BRASS_DARK);
      lg.addColorStop(0.5,  BRASS_HI);
      lg.addColorStop(0.82, BRASS_DARK);
      lg.addColorStop(1,    'rgba(212,172,108,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x, py, w, 1);
      for (const sx of [x + 6, x + w - 6]) {
        const sy = py - 2;
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 2);
        sg.addColorStop(0, BRASS_HI);
        sg.addColorStop(0.6, BRASS_DARK);
        sg.addColorStop(1, IRON.ink);
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawBrassPipe(pipeBot);

    // Gilt sweep — soft band moves across, scoped to plate by clip.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + 2, w, (badgeRow ? badgeSubY + 6 : pipeBot) - y - 4);
    ctx.clip();
    const sweepPhase = ((t * 0.22) % 1);
    const sweepX = x - w * 0.4 + sweepPhase * w * 1.8;
    const sweepG = ctx.createLinearGradient(sweepX, 0, sweepX + w * 0.45, 0);
    sweepG.addColorStop(0,    'rgba(212,172,108,0)');
    sweepG.addColorStop(0.5,  'rgba(212,172,108,0.10)');
    sweepG.addColorStop(1,    'rgba(212,172,108,0)');
    ctx.fillStyle = sweepG;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Floor name with brass-shimmer gradient.
    ctx.font = `bold ${uiSize(13)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Engraved back-shadow
    ctx.fillStyle = IRON.ink;
    ctx.fillText(upper, cx + 1, labelY + 1);
    const tw = ctx.measureText(upper).width;
    const phase = (t * 0.18) % 1;
    const gx = cx - tw / 2 - tw * 0.3 + phase * tw * 1.6;
    const tg = ctx.createLinearGradient(gx, 0, gx + tw * 0.6, 0);
    tg.addColorStop(0,    BRASS_DARK);
    tg.addColorStop(0.4,  BRASS_HI);
    tg.addColorStop(0.5,  BRASS_WHITE);
    tg.addColorStop(0.6,  BRASS_HI);
    tg.addColorStop(1,    BRASS_DARK);
    ctx.fillStyle = tg;
    ctx.fillText(upper, cx, labelY);

    const floorLine = `FLOOR ${floorIndex + 1} OF ${totalFloors}`;
    ctx.font = `${uiSize(9)}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = IRON.boneDim;
    ctx.fillText(floorLine, cx, floorSubY);
    if (badgeRow) {
      const badges = [];
      if (daily) badges.push('☼ DAILY');
      if (tag) badges.push(tag);
      ctx.font = `${uiSize(8)}px ${FONT_MONO}`;
      ctx.fillStyle = daily ? '#c8a86a' : IRON.boneDim;
      ctx.fillText(badges.join('  ·  '), cx, badgeSubY);
    }

    ctx.restore();
  }

  _drawFloorChip(r, floor, floorIndex) {
    const special = floor?.definition?.specialEnemyId || '';
    const y = TOP_PAD + 110;
    const chipH = 15;
    if (!special) return;
    const boss = special.startsWith('boss_');
    const text = boss ? 'BOSS' : 'ELITE';
    const col = boss ? COLOR.gold : '#c080ff';
    const x = boss ? Layout.canvasW - 74 : Layout.canvasW - 78;
    r.drawRect(x, y, 66, chipH, '#09060c');
    r.drawStrokedRect(x, y, 66, chipH, col, 1);
    r.drawText(text, x + 33, y + 7, {
      size: uiSize(9), bold: true, align: 'center', baseline: 'middle',
      family: FONT_MONO, color: col
    });
  }

  _drawDepthMeter(r, floorIndex, totalFloors) {
    // Thin vertical column on the far-right margin spanning the full HUD.
    // Lives outside the chip-row exclusion zone so it never overlaps the
    // DAILY badge or revive counter.
    const x = Layout.canvasW - 6;
    const y = TOP_PAD;
    const h = Layout.hud - TOP_PAD * 2 + 6;
    const pct = Math.max(0, Math.min(1, (floorIndex + 1) / Math.max(1, totalFloors)));
    r.drawRect(x, y, 3, h, '#0a0810');
    r.drawRect(x, y + (h * (1 - pct)), 3, h * pct, COLOR.gold);
    // 10 notches at 10% intervals
    for (let i = 1; i < 10; i++) {
      const ty = y + Math.round(h * (i / 10));
      r.drawRect(x - (i % 5 === 0 ? 3 : 2), ty, i % 5 === 0 ? 2 : 1, 1, COLOR.goldDim);
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

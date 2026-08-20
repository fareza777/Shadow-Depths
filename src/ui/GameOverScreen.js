/**
 * GameOverScreen — death epitaph + run stats + restart.
 *
 * Quick restart (per Pillar 3): pressing any confirm/move/tap routes back
 * into a new run with 1 input. Friction here kills retention.
 *
 * Visual: wrought-iron panel language (matches Pause / Inventory) —
 * scene-only draw cost, no gameplay FPS impact.
 *
 * Layout: the panel height GROWS with its content (word-wrapped narrative
 * lines) instead of clipping a fixed box — long tips/epitaphs wrap to 2-3
 * lines and only the lowest-priority footer entries are dropped when the
 * canvas is genuinely too short.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_MONO, FONT_BODY, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import {
  drawIronPanel, drawIronActionButton, drawInsetCard, drawSpacedText, IRON_PALETTE
} from './ironPanel.js';
import { t } from '../content/i18n.js';

const LAYOUT = IS_LANDSCAPE
  ? {
      panelW: 420, minPanelH: 300,
      titleY: 28, titleSize: 22, killedY: 52, lineGap: 14, statSize: 10,
      btnW: 150, btnH: 40, btnGap: 14
    }
  : {
      panelW: 340, minPanelH: 520,
      titleY: 36, titleSize: 26, killedY: 68, lineGap: 18, statSize: 12,
      btnW: 140, btnH: 46, btnGap: 12
    };

export class GameOverScreen {
  /**
   * @param {{ bus:object, summary:object }} deps
   */
  constructor({ bus, summary }) {
    this.bus = bus;
    this.summary = summary || {};
    this.selected = 0; // 0 = restart, 1 = title
    this._layoutCache = null;
  }

  enter() { this.selected = 0; }

  /** Truncate with an ellipsis until the text fits maxW. */
  _fit(r, text, maxW, opts) {
    const str = String(text);
    if (r.measureText(str, opts) <= maxW) return str;
    let s = str;
    while (s.length > 1 && r.measureText(`${s}…`, opts) > maxW) {
      s = s.slice(0, -1);
    }
    return `${s}…`;
  }

  /**
   * Word-wrap text into up to maxLines lines that each fit maxW.
   * The last line gets an ellipsis only if words had to be dropped —
   * full sentences stay intact whenever there is room for them.
   * @returns {string[]}
   */
  _wrap(r, text, maxW, opts, maxLines = 2) {
    const words = String(text).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const lines = [];
    let cur = '';
    let i = 0;
    while (i < words.length) {
      const trial = cur ? `${cur} ${words[i]}` : words[i];
      if (r.measureText(trial, opts) <= maxW) {
        cur = trial;
        i++;
      } else if (!cur) {
        cur = this._fit(r, words[i], maxW, opts); // single over-wide word
        i++;
      } else {
        lines.push(cur);
        cur = '';
        if (lines.length >= maxLines) break;
      }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (i < words.length && lines.length > 0) {
      let last = lines[lines.length - 1];
      while (last.length > 1 && r.measureText(`${last}…`, opts) > maxW) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = `${last}…`;
    }
    return lines;
  }

  /**
   * Compute (and cache) the whole screen layout for the current canvas.
   * Panel height adapts to the wrapped content; when even the minimum
   * height does not fit, footer entries are dropped from the END of the
   * list (lowest priority) until everything clears the buttons.
   */
  _layout(r) {
    const ch = Layout.canvasH || CANVAS_HEIGHT;
    const key = `${Layout.canvasW}x${ch}|${uiSize(10)}`;
    if (this._layoutCache && this._layoutCache.key === key) return this._layoutCache.value;

    const s = this.summary;
    const w = LAYOUT.panelW;
    const x = (CANVAS_WIDTH - w) / 2;
    const maxTextW = w - 36;

    // Epitaph — wraps to 2 lines instead of truncating mid-name.
    const killedBy = s.killedBy
      ? `${t('gameover.killed_by')} ${s.killedBy}`
      : t('gameover.killed_dark');
    const killedOpts = {
      size: uiSize(IS_LANDSCAPE ? 11 : 13), italic: true, align: 'center',
      family: FONT_BODY, color: IRON_PALETTE.boneDim, engraved: true
    };
    const killedLines = this._wrap(r, killedBy, w - 40, killedOpts, 2);
    const killedGap = IS_LANDSCAPE ? 14 : 16;

    const cardH = IS_LANDSCAPE ? 118 : 168;

    // Narrative footer in visual order; entries at the END are the first
    // to be dropped when space runs out, so the death hint stays visible.
    const smallSize = IS_LANDSCAPE ? 9 : 10;
    const smallGap = IS_LANDSCAPE ? 13 : 15;
    /** @type {{ opts:object, gap:number, lines:string[] }[]} */
    const foot = [];
    const addFoot = (text, size, gap, family, color, extra = {}) => {
      const opts = {
        size: uiSize(size), align: 'center', family, color,
        bold: !!extra.bold, italic: !!extra.italic
      };
      const lines = this._wrap(r, text, maxTextW, opts, extra.maxLines || 2);
      if (lines.length > 0) foot.push({ opts, gap, lines });
    };

    const skills = Array.isArray(s.skills) ? s.skills.filter(Boolean) : [];
    const gear = Array.isArray(s.gear) ? s.gear.filter(Boolean) : [];
    if (skills.length) {
      addFoot(`${t('gameover.build')}: ${skills.slice(0, 4).join(' · ')}`,
        smallSize, smallGap, FONT_BODY, IRON_PALETTE.boneDim);
    }
    if (gear.length) {
      addFoot(`${t('gameover.gear')}: ${gear.slice(0, 3).join(' · ')}`,
        smallSize, smallGap, FONT_BODY, IRON_PALETTE.boneDim);
    }
    if (s.deathHint) {
      const hintKey = `gameover.${s.deathHint}`;
      const hintText = t(hintKey);
      if (hintText && hintText !== hintKey) {
        addFoot(`${t('gameover.hint')}: ${hintText}`,
          IS_LANDSCAPE ? 9 : 11, IS_LANDSCAPE ? 14 : 16,
          FONT_BODY, COLOR.textHeal, { maxLines: 3 });
      }
    }
    if (s.teachLine) {
      const teachKey = `gameover.${s.teachLine}`;
      const teachText = t(teachKey);
      if (teachText && teachText !== teachKey) {
        addFoot(teachText, smallSize, smallGap, FONT_BODY,
          IRON_PALETTE.boneDim, { maxLines: 3 });
      }
    }
    if (s.biomeTeaser?.name) {
      addFoot(`${t('gameover.teaser')}: ${s.biomeTeaser.name}`,
        smallSize, IS_LANDSCAPE ? 12 : 14, FONT_DISPLAY, IRON_PALETTE.brass);
      if (s.biomeTeaser.atmosphere) {
        addFoot(s.biomeTeaser.atmosphere, 8, IS_LANDSCAPE ? 12 : 14,
          FONT_BODY, IRON_PALETTE.boneDim, { italic: true, maxLines: 3 });
      }
    }
    if (s.isNewHighScore) {
      addFoot(t('gameover.highscore'), 12, 16, FONT_DISPLAY,
        COLOR.textXP, { bold: true, maxLines: 1 });
    }
    if (s.coinsEarned > 0) {
      addFoot(`+${s.coinsEarned} ◈ ${t('gameover.coins')}`,
        11, 14, FONT_MONO, IRON_PALETTE.brass, { bold: true, maxLines: 1 });
    }
    if (Array.isArray(s.unlocked) && s.unlocked.length > 0) {
      addFoot(`${t('gameover.unlocked')}: ${s.unlocked.join(', ')}`,
        10, 12, FONT_BODY, COLOR.textHeal);
    }

    const showUnlockCta = s.showUnlockCta
      || (!s.premiumUnlocked && (s.floorReached ?? ((s.floorsCleared || 0) + 1)) < 100);
    const ctaH = IS_LANDSCAPE ? 14 : 18;
    const { btnW, btnH, btnGap } = LAYOUT;

    // Vertical plan, measured as heights from the panel top:
    //   killedY (first epitaph baseline) + extra epitaph lines + divider
    //   gap + 10 + stats card + 10 + footer + CTA gap + buttons + 20 pad.
    const divGap = IS_LANDSCAPE ? 12 : 16;
    const headerH = LAYOUT.killedY + (killedLines.length - 1) * killedGap
      + divGap + 10 + cardH + 10;
    const chrome = (showUnlockCta ? ctaH + 6 : 8) + btnH + 20;
    const footHeight = () => foot.reduce((acc, e) => {
      const lineH = e.opts.size + 4;
      let h = 0;
      for (let i = 0; i < e.lines.length; i++) {
        h += i === e.lines.length - 1 ? Math.max(e.gap, lineH) : lineH;
      }
      return acc + h;
    }, 0);

    let h = headerH + footHeight() + chrome;
    while (h > ch - 24 && foot.length > 0) {
      foot.pop();
      h = headerH + footHeight() + chrome;
    }
    h = Math.min(Math.max(h, Math.min(LAYOUT.minPanelH, ch - 24)), ch - 24);

    const y = Math.max(8, (ch - h) / 2);
    const panel = { x, y, w, h };

    const killedY0 = y + LAYOUT.killedY;
    const divY = killedY0 + (killedLines.length - 1) * killedGap + divGap;
    const cardY = divY + 10;

    const totalBtnW = btnW * 2 + btnGap;
    const by = y + h - btnH - 20;
    const startX = x + (w - totalBtnW) / 2;
    const btns = [
      { x: startX, y: by, w: btnW, h: btnH },
      { x: startX + btnW + btnGap, y: by, w: btnW, h: btnH }
    ];

    const value = {
      panel, killedLines, killedOpts, killedGap, killedY0, divY,
      cardY, cardH, foot, showUnlockCta, ctaH, maxTextW, btns
    };
    this._layoutCache = { key, value };
    return value;
  }

  _buttonRects() {
    if (this._layoutCache) return this._layoutCache.value.btns;
    // Fallback before the first render (hit tests only arrive after one).
    const ch = Layout.canvasH || CANVAS_HEIGHT;
    const h = Math.min(LAYOUT.minPanelH, ch - 24);
    const y = Math.max(8, (ch - h) / 2);
    const { btnW, btnH, btnGap } = LAYOUT;
    const totalW = btnW * 2 + btnGap;
    const by = y + h - btnH - 20;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    return [
      { x: startX, y: by, w: btnW, h: btnH },
      { x: startX + btnW + btnGap, y: by, w: btnW, h: btnH }
    ];
  }

  render(r) {
    const ctx = r.ctx;
    const L = this._layout(r);
    const p = L.panel;

    // Deep void + cheap edge vignette (4 rects, no blur).
    r.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, '#06050a');
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 48);
    ctx.fillRect(0, CANVAS_HEIGHT - 64, CANVAS_WIDTH, 64);
    ctx.fillRect(0, 0, 28, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - 28, 0, 28, CANVAS_HEIGHT);
    ctx.restore();

    drawIronPanel(ctx, p.x, p.y, p.w, p.h);

    // Title — Cinzel spaced + engraved (no shadowBlur).
    ctx.save();
    ctx.font = `bold ${uiSize(LAYOUT.titleSize)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const title = t('gameover.title');
    const tx = CANVAS_WIDTH / 2;
    const ty = p.y + LAYOUT.titleY;
    ctx.fillStyle = '#1a0808';
    drawSpacedText(ctx, title, tx + 1, ty + 1, 5);
    ctx.fillStyle = COLOR.textCrit;
    drawSpacedText(ctx, title, tx, ty, 5);
    ctx.restore();

    // Epitaph (1-2 wrapped lines).
    L.killedLines.forEach((line, i) => {
      r.drawText(line, CANVAS_WIDTH / 2, L.killedY0 + i * L.killedGap, L.killedOpts);
    });

    // Brass hairline under epitaph.
    const divY = L.divY;
    const divX = p.x + 28;
    const divW = p.w - 56;
    const grad = ctx.createLinearGradient(divX, divY, divX + divW, divY);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, IRON_PALETTE.brass);
    grad.addColorStop(1, 'transparent');
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = grad;
    ctx.fillRect(divX, divY, divW, 1);
    ctx.restore();

    const s = this.summary;
    const lines = [
      [t('gameover.floor'), `${(s.floorsCleared || 0) + 1}`],
      [t('gameover.enemies'), s.enemiesDefeated || 0],
      [t('gameover.items'), s.itemsUsed || 0],
      [t('gameover.xp'), s.xpGained || 0],
      [t('gameover.gold'), s.goldCollected || 0],
      [t('gameover.turns'), s.turnsUsed || 0],
      ['', ''],
      [t('gameover.score'), s.score ?? 0]
    ];

    const cardY = L.cardY;
    const cardH = L.cardH;
    drawInsetCard(ctx, p.x + 22, cardY, p.w - 44, cardH, { dark: true });

    const startY = cardY + 12;
    const gap = LAYOUT.lineGap;
    for (let i = 0; i < lines.length; i++) {
      const [label, value] = lines[i];
      if (!label && value === '') continue;
      const big = label === t('gameover.score');
      const ly = startY + i * gap;
      r.drawText(String(label), CANVAS_WIDTH / 2 - 12, ly, {
        size: uiSize(big ? LAYOUT.statSize + 2 : LAYOUT.statSize),
        bold: big, align: 'right', family: FONT_MONO,
        color: big ? IRON_PALETTE.brass : IRON_PALETTE.bone
      });
      r.drawText(String(value), CANVAS_WIDTH / 2 + 12, ly, {
        size: uiSize(big ? LAYOUT.statSize + 2 : LAYOUT.statSize),
        bold: big, align: 'left', family: FONT_MONO,
        color: big ? IRON_PALETTE.brass : IRON_PALETTE.bone
      });
    }

    // --- footer narrative (word-wrapped, top-down) ----------------------
    let footY = cardY + cardH + 10;
    for (const e of L.foot) {
      const lineH = e.opts.size + 4;
      for (let i = 0; i < e.lines.length; i++) {
        r.drawText(e.lines[i], CANVAS_WIDTH / 2, footY, e.opts);
        footY += i === e.lines.length - 1 ? Math.max(e.gap, lineH) : lineH;
      }
    }

    if (L.showUnlockCta) {
      const ctaOpts = {
        size: uiSize(IS_LANDSCAPE ? 9 : 11), align: 'center',
        family: FONT_BODY, color: IRON_PALETTE.brass
      };
      r.drawText(this._fit(r, t('gameover.unlock_cta'), L.maxTextW, ctaOpts),
        CANVAS_WIDTH / 2, L.btns[0].y - L.ctaH, ctaOpts);
    }

    drawIronActionButton(r, L.btns[0].x, L.btns[0].y, L.btns[0].w, L.btns[0].h,
      t('gameover.restart'), {
        accent: IRON_PALETTE.brass,
        pressed: this.selected === 0,
        glyph: '↻',
        fontSize: 13
      });
    drawIronActionButton(r, L.btns[1].x, L.btns[1].y, L.btns[1].w, L.btns[1].h,
      t('gameover.title_btn'), {
        accent: IRON_PALETTE.boneDim,
        pressed: this.selected === 1,
        glyph: '⌂',
        fontSize: 12
      });
  }

  handleInput(action) {
    if (action.type === 'move') {
      if (action.dx === -1) this.selected = 0;
      else if (action.dx === 1) this.selected = 1;
    } else if (action.type === 'confirm') {
      this._activate(this.selected);
    } else if (action.type === 'tap' && typeof action.buttonIndex === 'number') {
      this._activate(action.buttonIndex);
    } else if (action.type === 'escape') {
      this._activate(1);
    }
  }

  _activate(idx) {
    if (idx === 0) this.bus.emit('request:newRun', {});
    else this.bus.emit('request:quitToTitle', {});
  }

  /** Hit-test for tap input. */
  hitTest(x, y) {
    const btns = this._buttonRects();
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
    }
    return -1;
  }
}

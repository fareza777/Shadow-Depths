/**
 * GameOverScreen — death epitaph + run stats + restart.
 *
 * Quick restart (per Pillar 3): pressing any confirm/move/tap routes back
 * into a new run with 1 input. Friction here kills retention.
 *
 * Visual: wrought-iron panel language (matches Pause / Inventory) —
 * scene-only draw cost, no gameplay FPS impact.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_MONO, FONT_BODY, uiSize
} from '../config/constants.js';
import {
  drawIronPanel, drawIronActionButton, drawInsetCard, drawSpacedText, IRON_PALETTE
} from './ironPanel.js';
import { t } from '../content/i18n.js';

const LAYOUT = IS_LANDSCAPE
  ? {
      panelW: 420, panelH: 300,
      titleY: 28, titleSize: 22, killedY: 52, statsY: 72, lineGap: 14, statSize: 10,
      btnW: 150, btnH: 40, btnGap: 14
    }
  : {
      panelW: 340, panelH: 520,
      titleY: 36, titleSize: 26, killedY: 68, statsY: 96, lineGap: 18, statSize: 12,
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
  }

  enter() { this.selected = 0; }

  _panelRect() {
    const w = LAYOUT.panelW;
    const h = Math.min(LAYOUT.panelH, CANVAS_HEIGHT - 24);
    return {
      x: (CANVAS_WIDTH - w) / 2,
      y: Math.max(8, (CANVAS_HEIGHT - h) / 2),
      w, h
    };
  }

  _buttonRects() {
    const p = this._panelRect();
    const { btnW, btnH, btnGap } = LAYOUT;
    const totalW = btnW * 2 + btnGap;
    const by = p.y + p.h - btnH - 20;
    const startX = p.x + (p.w - totalW) / 2;
    return [
      { x: startX, y: by, w: btnW, h: btnH },
      { x: startX + btnW + btnGap, y: by, w: btnW, h: btnH }
    ];
  }

  render(r) {
    const ctx = r.ctx;
    const p = this._panelRect();

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

    const killedBy = this.summary.killedBy
      ? `${t('gameover.killed_by')} ${this.summary.killedBy}`
      : t('gameover.killed_dark');
    r.drawText(killedBy, CANVAS_WIDTH / 2, p.y + LAYOUT.killedY, {
      size: uiSize(IS_LANDSCAPE ? 11 : 13), italic: true, align: 'center',
      family: FONT_BODY, color: IRON_PALETTE.boneDim, engraved: true
    });

    // Brass hairline under epitaph.
    const divY = p.y + LAYOUT.killedY + (IS_LANDSCAPE ? 12 : 16);
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

    const cardY = divY + 10;
    const cardH = IS_LANDSCAPE ? 118 : 168;
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
        color: big ? IRON_PALETTE.brassHi : IRON_PALETTE.bone
      });
    }

    let footY = cardY + cardH + 10;
    const skills = Array.isArray(s.skills) ? s.skills.filter(Boolean) : [];
    const gear = Array.isArray(s.gear) ? s.gear.filter(Boolean) : [];
    if (skills.length) {
      r.drawText(`${t('gameover.build')}: ${skills.slice(0, 4).join(' · ')}`,
        CANVAS_WIDTH / 2, footY, {
          size: uiSize(IS_LANDSCAPE ? 9 : 10), align: 'center',
          family: FONT_BODY, color: IRON_PALETTE.boneDim
        });
      footY += IS_LANDSCAPE ? 13 : 15;
    }
    if (gear.length) {
      r.drawText(`${t('gameover.gear')}: ${gear.slice(0, 3).join(' · ')}`,
        CANVAS_WIDTH / 2, footY, {
          size: uiSize(IS_LANDSCAPE ? 9 : 10), align: 'center',
          family: FONT_BODY, color: IRON_PALETTE.boneDim
        });
      footY += IS_LANDSCAPE ? 13 : 15;
    }
    if (s.deathHint) {
      const hintKey = `gameover.${s.deathHint}`;
      const hintText = t(hintKey);
      if (hintText && hintText !== hintKey) {
        r.drawText(`${t('gameover.hint')}: ${hintText}`, CANVAS_WIDTH / 2, footY, {
          size: uiSize(IS_LANDSCAPE ? 9 : 11), align: 'center',
          family: FONT_BODY, color: COLOR.textHeal
        });
        footY += IS_LANDSCAPE ? 14 : 16;
      }
    }
    if (s.teachLine) {
      const teachKey = `gameover.${s.teachLine}`;
      const teachText = t(teachKey);
      if (teachText && teachText !== teachKey) {
        r.drawText(teachText, CANVAS_WIDTH / 2, footY, {
          size: uiSize(IS_LANDSCAPE ? 9 : 10), align: 'center',
          family: FONT_BODY, color: IRON_PALETTE.boneDim
        });
        footY += IS_LANDSCAPE ? 13 : 15;
      }
    }
    if (s.biomeTeaser?.name) {
      r.drawText(`${t('gameover.teaser')}: ${s.biomeTeaser.name}`, CANVAS_WIDTH / 2, footY, {
        size: uiSize(IS_LANDSCAPE ? 9 : 10), align: 'center',
        family: FONT_DISPLAY, color: IRON_PALETTE.brass
      });
      footY += IS_LANDSCAPE ? 12 : 14;
      if (s.biomeTeaser.atmosphere) {
        r.drawText(s.biomeTeaser.atmosphere, CANVAS_WIDTH / 2, footY, {
          size: uiSize(8), italic: true, align: 'center',
          family: FONT_BODY, color: IRON_PALETTE.boneDim
        });
        footY += IS_LANDSCAPE ? 12 : 14;
      }
    }
    if (s.isNewHighScore) {
      r.drawText(t('gameover.highscore'), CANVAS_WIDTH / 2, footY, {
        size: uiSize(12), bold: true, align: 'center',
        family: FONT_DISPLAY, color: COLOR.textXP, engraved: true
      });
      footY += 16;
    }
    if (s.coinsEarned > 0) {
      r.drawText(`+${s.coinsEarned} ◈ ${t('gameover.coins')}`,
        CANVAS_WIDTH / 2, footY, {
          size: uiSize(11), bold: true, align: 'center',
          family: FONT_MONO, color: IRON_PALETTE.brass
        });
      footY += 14;
    }
    if (Array.isArray(s.unlocked) && s.unlocked.length > 0) {
      r.drawText(`${t('gameover.unlocked')}: ${s.unlocked.join(', ')}`,
        CANVAS_WIDTH / 2, footY, {
          size: uiSize(10), align: 'center',
          family: FONT_BODY, color: COLOR.textHeal
        });
    }

    const btns = this._buttonRects();
    const showUnlockCta = s.showUnlockCta
      || (!s.premiumUnlocked && (s.floorReached ?? ((s.floorsCleared || 0) + 1)) < 100);
    if (showUnlockCta) {
      r.drawText(t('gameover.unlock_cta'), CANVAS_WIDTH / 2, btns[0].y - (IS_LANDSCAPE ? 14 : 18), {
        size: uiSize(IS_LANDSCAPE ? 9 : 11), align: 'center',
        family: FONT_BODY, color: IRON_PALETTE.brass
      });
    }

    drawIronActionButton(r, btns[0].x, btns[0].y, btns[0].w, btns[0].h,
      t('gameover.restart'), {
        accent: IRON_PALETTE.brass,
        pressed: this.selected === 0,
        glyph: '↻',
        fontSize: 13
      });
    drawIronActionButton(r, btns[1].x, btns[1].y, btns[1].w, btns[1].h,
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

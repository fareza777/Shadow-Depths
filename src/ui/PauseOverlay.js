/**
 * PauseOverlay — wrought-iron pause modal (matches iron-screens.jsx
 * photo 3). Compact panel with PAUSED title, italic subtitle, and two
 * stacked iron buttons (RESUME / QUIT TO MENU).
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_BODY, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import {
  drawIronPanel, drawIronActionButton, drawSpacedText, IRON_PALETTE
} from './ironPanel.js';
import { t } from '../content/i18n.js';

export class PauseOverlay {
  /** @param {{ bus: object }} deps */
  constructor({ bus }) {
    this.bus = bus;
    this.open = false;
    this.selected = 0;
    bus.on('request:newRun', () => this.hide());
    bus.on('scene:switched', ({ to }) => {
      if (to !== 'game') this.hide();
    });
  }

  show() { this.open = true; this.selected = 0; }
  hide() { this.open = false; }
  toggle() { this.open ? this.hide() : this.show(); }

  handleInput(action) {
    if (!this.open) return false;
    switch (action.type) {
      case 'move':
        if (action.dy === -1) this.selected = 0;
        else if (action.dy === 1) this.selected = 1;
        return true;
      case 'confirm':
        this._activate(this.selected);
        return true;
      case 'escape':
      case 'menu':
        this.hide();
        return true;
      case 'tap':
      case 'pointer': {
        const idx = action.buttonIndex;
        if (idx === 0 || idx === 1 || idx === 2) {
          this.selected = idx;
          this._activate(idx);
          return true;
        }
        if (idx === 99) { this.hide(); return true; }
        return true;
      }
      default:
        return true;
    }
  }

  _activate(idx) {
    if (idx === 0) this.hide();
    else if (idx === 1) { this.hide(); this.bus.emit('request:openCrafting', {}); }
    else this.bus.emit('request:quitToTitle', {});
  }

  _panelRect() {
    const screenH = Layout.canvasH || CANVAS_HEIGHT;
    const panelW = IS_LANDSCAPE ? 360 : 340;
    const panelH = IS_LANDSCAPE ? 280 : 326;
    return {
      x: (CANVAS_WIDTH - panelW) / 2,
      y: (screenH - panelH) / 2,
      w: panelW, h: panelH
    };
  }

  _buttons() {
    const p = this._panelRect();
    const btnW = p.w - 56;
    const btnH = IS_LANDSCAPE ? 44 : 50;
    const btnX = p.x + 28;
    const baseY = p.y + 110;
    return [
      { x: btnX, y: baseY, w: btnW, h: btnH },
      { x: btnX, y: baseY + btnH + 10, w: btnW, h: btnH },
      { x: btnX, y: baseY + (btnH + 10) * 2, w: btnW, h: btnH - 4 }
    ];
  }

  render(renderer) {
    if (!this.open) return;
    const ctx = renderer.ctx;
    const screenH = Layout.canvasH || CANVAS_HEIGHT;

    // Dim the world behind.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, screenH);
    ctx.restore();

    const p = this._panelRect();
    drawIronPanel(ctx, p.x, p.y, p.w, p.h);

    // PAUSED title (centered, brass, spaced) + glow.
    ctx.save();
    ctx.font = `bold ${uiSize(30)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = IRON_PALETTE.brass + '88';
    ctx.shadowBlur = 16;
    drawSpacedText(ctx, t('pause.title'),
      CANVAS_WIDTH / 2, p.y + 42, 8);
    ctx.restore();

    renderer.drawText(t('pause.subtitle'), CANVAS_WIDTH / 2, p.y + 70, {
      size: uiSize(11), italic: true, align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: IRON_PALETTE.boneDim
    });

    // Brass hairline divider below subtitle.
    const divX = p.x + 24, divW = p.w - 48;
    const divY = p.y + 92;
    const grad = ctx.createLinearGradient(divX, divY, divX + divW, divY);
    grad.addColorStop(0,    'transparent');
    grad.addColorStop(0.5,  IRON_PALETTE.brass);
    grad.addColorStop(1,    'transparent');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grad;
    ctx.fillRect(divX, divY, divW, 1);
    ctx.restore();

    // Two stacked buttons.
    const btns = this._buttons();
    drawIronActionButton(renderer, btns[0].x, btns[0].y, btns[0].w, btns[0].h,
      t('pause.resume'), {
        accent: IRON_PALETTE.brass,
        pressed: this.selected === 0,
        glyph: '▶',
        fontSize: 15
      });
    drawIronActionButton(renderer, btns[1].x, btns[1].y, btns[1].w, btns[1].h,
      t('pause.forge'), {
        accent: IRON_PALETTE.ember,
        pressed: this.selected === 1,
        glyph: '◈',
        fontSize: 14
      });
    drawIronActionButton(renderer, btns[2].x, btns[2].y, btns[2].w, btns[2].h,
      t('pause.quit'), {
        accent: IRON_PALETTE.blood,
        pressed: this.selected === 2,
        glyph: '✕',
        fontSize: 13
      });
  }

  hitTest(x, y) {
    if (!this.open) return -1;
    const btns = this._buttons();
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
    }
    return 99;
  }
}

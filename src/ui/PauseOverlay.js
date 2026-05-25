/**
 * PauseOverlay — in-run pause sheet with resume or abandon to title.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_BODY, uiSize
} from '../config/constants.js';

export class PauseOverlay {
  /** @param {{ bus: object }} deps */
  constructor({ bus }) {
    this.bus = bus;
    this.open = false;
    this.selected = 0; // 0 resume, 1 quit
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
        if (idx === 0 || idx === 1) {
          this.selected = idx;
          this._activate(idx);
          return true;
        }
        if (idx === 99) {
          this.hide();
          return true;
        }
        return true;
      }
      default:
        return true;
    }
  }

  _activate(idx) {
    if (idx === 0) this.hide();
    else this.bus.emit('request:quitToTitle', {});
  }

  render(renderer) {
    if (!this.open) return;
    const ctx = renderer.ctx;
    ctx.save();
    ctx.globalAlpha = 0.72;
    renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, '#000');
    ctx.restore();

    const panelW = IS_LANDSCAPE ? 360 : 320;
    const panelH = IS_LANDSCAPE ? 200 : 240;
    const px = (CANVAS_WIDTH - panelW) / 2;
    const py = (CANVAS_HEIGHT - panelH) / 2;
    renderer.drawRect(px, py, panelW, panelH, COLOR.bgPanel);
    renderer.drawStrokedRect(px, py, panelW, panelH, COLOR.gold, 2);
    renderer.drawRect(px + 8, py + 8, panelW - 16, 3, COLOR.goldDim);

    renderer.drawText('PAUSED', CANVAS_WIDTH / 2, py + 28, {
      size: uiSize(20), bold: true, align: 'center',
      family: FONT_DISPLAY, color: COLOR.gold
    });
    renderer.drawText('the descent can wait', CANVAS_WIDTH / 2, py + 52, {
      size: uiSize(12), italic: true, align: 'center',
      family: FONT_BODY, color: COLOR.textMuted
    });

    const btnW = panelW - 48;
    const btnH = IS_LANDSCAPE ? 44 : 52;
    const btnX = px + 24;
    const labels = ['RESUME', 'QUIT TO MENU'];
    for (let i = 0; i < 2; i++) {
      const by = py + 88 + i * (btnH + 12);
      const sel = i === this.selected;
      renderer.drawRect(btnX, by, btnW, btnH, sel ? COLOR.bgCardHi : COLOR.bgCard);
      renderer.drawStrokedRect(btnX, by, btnW, btnH, sel ? COLOR.gold : COLOR.borderSoft, sel ? 2 : 1);
      renderer.drawText(labels[i], btnX + btnW / 2, by + btnH / 2, {
        size: uiSize(15), bold: true, align: 'center', baseline: 'middle',
        family: FONT_DISPLAY, color: i === 1 ? COLOR.textCrit : COLOR.textPrimary
      });
    }
  }

  hitTest(x, y) {
    if (!this.open) return -1;
    const panelW = IS_LANDSCAPE ? 360 : 320;
    const panelH = IS_LANDSCAPE ? 200 : 240;
    const px = (CANVAS_WIDTH - panelW) / 2;
    const py = (CANVAS_HEIGHT - panelH) / 2;
    const btnW = panelW - 48;
    const btnH = IS_LANDSCAPE ? 44 : 52;
    const btnX = px + 24;
    for (let i = 0; i < 2; i++) {
      const by = py + 88 + i * (btnH + 12);
      if (x >= btnX && x <= btnX + btnW && y >= by && y <= by + btnH) return i;
    }
    return 99;
  }
}

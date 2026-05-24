/**
 * VictoryScreen — shown after clearing the final floor. Same scene contract
 * as GameOverScreen. Foreshadows v0.3 expansion per Section 9.5 of the brief.
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants.js';

export class VictoryScreen {
  /**
   * @param {{ bus:object, summary:object }} deps
   */
  constructor({ bus, summary }) {
    this.bus = bus;
    this.summary = summary || {};
    this.selected = 0;
  }

  enter() { this.selected = 0; }

  render(r) {
    r.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, '#06060a');
    r.drawText('YOU ESCAPED', CANVAS_WIDTH / 2, 90,
      { size: 36, bold: true, align: 'center', color: '#d6c87a' });
    r.drawText('the Depths… for now.', CANVAS_WIDTH / 2, 134,
      { size: 14, align: 'center', color: COLOR.textMuted });

    const s = this.summary;
    const lines = [
      ['Floors cleared', s.floorsCleared || 0],
      ['Enemies defeated', s.enemiesDefeated || 0],
      ['Perfect floors', s.perfectFloors || 0],
      ['Turns played', s.turnsUsed || 0],
      ['Gold', s.goldCollected || 0],
      ['', ''],
      ['SCORE', s.score ?? 0]
    ];
    const startY = 190;
    for (let i = 0; i < lines.length; i++) {
      const [label, value] = lines[i];
      const big = label === 'SCORE';
      r.drawText(String(label), CANVAS_WIDTH / 2 - 80, startY + i * 24,
        { size: big ? 14 : 12, bold: big, align: 'right', color: big ? '#d6c87a' : COLOR.textPrimary });
      r.drawText(String(value), CANVAS_WIDTH / 2 + 80, startY + i * 24,
        { size: big ? 14 : 12, bold: big, align: 'left',  color: big ? '#d6c87a' : COLOR.textPrimary });
    }

    if (s.isNewHighScore) {
      r.drawText('★ NEW HIGH SCORE ★', CANVAS_WIDTH / 2, startY + lines.length * 24 + 10,
        { size: 14, bold: true, align: 'center', color: COLOR.textXP });
    }

    const buttons = ['NEW RUN', 'TITLE'];
    const w = 180, h = 48;
    const by = CANVAS_HEIGHT - 260;
    const totalW = buttons.length * w + (buttons.length - 1) * 20;
    let bx = (CANVAS_WIDTH - totalW) / 2;
    for (let i = 0; i < buttons.length; i++) {
      const sel = i === this.selected;
      r.drawRect(bx, by, w, h, sel ? '#2a2438' : '#16141c');
      r.drawStrokedRect(bx, by, w, h, sel ? '#d6c87a' : '#3a3340', sel ? 2 : 1);
      r.drawText(buttons[i], bx + w / 2, by + h / 2,
        { size: 13, bold: true, align: 'center', baseline: 'middle' });
      bx += w + 20;
    }
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

  hitTest(x, y) {
    const buttons = 2, w = 180, h = 48;
    const by = CANVAS_HEIGHT - 260;
    const totalW = buttons * w + (buttons - 1) * 20;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    for (let i = 0; i < buttons; i++) {
      const bx = startX + i * (w + 20);
      if (x >= bx && x <= bx + w && y >= by && y <= by + h) return i;
    }
    return -1;
  }
}

/**
 * VictoryScreen — shown after clearing the final floor.
 * Mirrors GameOverScreen polish: i18n, build/gear recap, coins/high-score.
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE } from '../config/constants.js';
import { t } from '../content/i18n.js';

const LAYOUT = IS_LANDSCAPE
  ? { titleY: 24, titleSize: 26, subY: 50, statsY: 72, lineGap: 15, statSize: 10,
      btnW: 160, btnH: 44, btnY: CANVAS_HEIGHT - 56 }
  : { titleY: 56, titleSize: 34, subY: 100, statsY: 132, lineGap: 20, statSize: 12,
      btnW: 180, btnH: 48, btnY: CANVAS_HEIGHT - 240 };

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
    r.drawText(t('victory.title'), CANVAS_WIDTH / 2, LAYOUT.titleY,
      { size: LAYOUT.titleSize, bold: true, align: 'center', color: '#d6c87a' });
    r.drawText(t('victory.subtitle'), CANVAS_WIDTH / 2, LAYOUT.subY,
      { size: IS_LANDSCAPE ? 11 : 14, align: 'center', color: COLOR.textMuted });

    const s = this.summary;
    const lines = [
      [t('victory.floors'), s.floorsCleared || 0],
      [t('victory.enemies'), s.enemiesDefeated || 0],
      [t('victory.perfect'), s.perfectFloors || 0],
      [t('victory.turns'), s.turnsUsed || 0],
      [t('victory.gold'), s.goldCollected || 0],
      ['', ''],
      [t('victory.score'), s.score ?? 0]
    ];
    const startY = LAYOUT.statsY;
    const gap = LAYOUT.lineGap;
    for (let i = 0; i < lines.length; i++) {
      const [label, value] = lines[i];
      const big = label === t('victory.score');
      r.drawText(String(label), CANVAS_WIDTH / 2 - 70, startY + i * gap,
        { size: big ? LAYOUT.statSize + 2 : LAYOUT.statSize, bold: big, align: 'right',
          color: big ? '#d6c87a' : COLOR.textPrimary });
      r.drawText(String(value), CANVAS_WIDTH / 2 + 70, startY + i * gap,
        { size: big ? LAYOUT.statSize + 2 : LAYOUT.statSize, bold: big, align: 'left',
          color: big ? '#d6c87a' : COLOR.textPrimary });
    }

    let footY = startY + lines.length * gap + 6;
    const skills = Array.isArray(s.skills) ? s.skills.filter(Boolean) : [];
    const gear = Array.isArray(s.gear) ? s.gear.filter(Boolean) : [];
    if (skills.length) {
      r.drawText(`${t('gameover.build')}: ${skills.slice(0, 4).join(' · ')}`,
        CANVAS_WIDTH / 2, footY,
        { size: IS_LANDSCAPE ? 9 : 10, align: 'center', color: '#a89cb0' });
      footY += IS_LANDSCAPE ? 14 : 16;
    }
    if (gear.length) {
      r.drawText(`${t('gameover.gear')}: ${gear.slice(0, 3).join(' · ')}`,
        CANVAS_WIDTH / 2, footY,
        { size: IS_LANDSCAPE ? 9 : 10, align: 'center', color: '#a89cb0' });
      footY += IS_LANDSCAPE ? 14 : 16;
    }
    r.drawText(t('victory.foreshadow'), CANVAS_WIDTH / 2, footY,
      { size: IS_LANDSCAPE ? 9 : 11, align: 'center', color: COLOR.textHeal });
    footY += IS_LANDSCAPE ? 16 : 18;

    if (s.isNewHighScore) {
      r.drawText(t('gameover.highscore'), CANVAS_WIDTH / 2, footY,
        { size: 13, bold: true, align: 'center', color: COLOR.textXP });
      footY += 18;
    }
    if (s.coinsEarned > 0) {
      r.drawText(`+${s.coinsEarned} ◈ ${t('gameover.coins')}`,
        CANVAS_WIDTH / 2, footY,
        { size: 11, bold: true, align: 'center', color: '#d6c87a' });
      footY += 16;
    }
    if (Array.isArray(s.unlocked) && s.unlocked.length > 0) {
      r.drawText(`${t('gameover.unlocked')}: ${s.unlocked.join(', ')}`,
        CANVAS_WIDTH / 2, footY,
        { size: 10, align: 'center', color: COLOR.textHeal });
    }

    const buttons = [t('victory.newrun'), t('victory.title_btn')];
    const w = LAYOUT.btnW, h = LAYOUT.btnH;
    const by = LAYOUT.btnY;
    const gapBtn = 16;
    const totalW = buttons.length * w + (buttons.length - 1) * gapBtn;
    let bx = (CANVAS_WIDTH - totalW) / 2;
    for (let i = 0; i < buttons.length; i++) {
      const sel = i === this.selected;
      r.drawRect(bx, by, w, h, sel ? '#2a2438' : '#16141c');
      r.drawStrokedRect(bx, by, w, h, sel ? '#d6c87a' : '#3a3340', sel ? 2 : 1);
      r.drawText(buttons[i], bx + w / 2, by + h / 2,
        { size: 13, bold: true, align: 'center', baseline: 'middle' });
      bx += w + gapBtn;
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
    const buttons = 2, w = LAYOUT.btnW, h = LAYOUT.btnH;
    const by = LAYOUT.btnY;
    const gapBtn = 16;
    const totalW = buttons * w + (buttons - 1) * gapBtn;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    for (let i = 0; i < buttons; i++) {
      const bx = startX + i * (w + gapBtn);
      if (x >= bx && x <= bx + w && y >= by && y <= by + h) return i;
    }
    return -1;
  }
}

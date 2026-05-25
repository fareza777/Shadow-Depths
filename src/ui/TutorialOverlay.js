/**
 * TutorialOverlay — 3-step first-run hints (move, attack, pickup).
 * Blocks input until dismissed; sets meta.settings.showTutorial = false.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, COLOR, FONT_DISPLAY, FONT_BODY, uiSize
} from '../config/constants.js';

const STEPS = [
  {
    title: 'MOVE',
    body: 'Use the D-pad (bottom-left) or tap a floor tile to walk one step per turn.'
  },
  {
    title: 'ATTACK',
    body: 'Walk into an enemy, tap them when adjacent, or tap your hero while a foe is next to you.'
  },
  {
    title: 'LOOT & DESCEND',
    body: 'PICK gathers items underfoot. DOWN uses stairs. BAG opens inventory. Tap anywhere to continue.'
  }
];

export class TutorialOverlay {
  /**
   * @param {{ metaProgress?: { setSetting: Function, save?: Function } }} deps
   */
  constructor({ metaProgress } = {}) {
    this.meta = metaProgress || null;
    this.open = false;
    this._step = 0;
  }

  /** @param {boolean} show */
  show(show = true) {
    this.open = !!show;
    this._step = 0;
  }

  hide() {
    this.open = false;
    if (this.meta) this.meta.setSetting('showTutorial', false);
  }

  render(renderer) {
    if (!this.open) return;
    const step = STEPS[this._step] || STEPS[STEPS.length - 1];
    const r = renderer;
    const panelH = 168;
    const y = CANVAS_HEIGHT - panelH - 8;

    r.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(0,0,0,0.55)');
    r.drawRect(12, y, CANVAS_WIDTH - 24, panelH, COLOR.bgPanel);
    r.drawStrokedRect(12, y, CANVAS_WIDTH - 24, panelH, COLOR.gold, 2);
    r.drawRect(12, y, CANVAS_WIDTH - 24, 3, COLOR.gold);

    r.drawText('FIRST RUN', CANVAS_WIDTH / 2, y + 22,
      { size: uiSize(11), align: 'center', color: COLOR.textMuted, family: FONT_BODY });
    r.drawText(step.title, CANVAS_WIDTH / 2, y + 48,
      { size: uiSize(20), bold: true, align: 'center', color: COLOR.gold, family: FONT_DISPLAY });

    const lines = wrapText(step.body, 38);
    let ly = y + 78;
    for (const line of lines) {
      r.drawText(line, CANVAS_WIDTH / 2, ly,
        { size: uiSize(13), align: 'center', color: COLOR.textPrimary, family: FONT_BODY });
      ly += uiSize(16);
    }

    const hint = this._step < STEPS.length - 1 ? 'Tap to continue' : 'Tap to play';
    r.drawText(`${this._step + 1} / ${STEPS.length}  ·  ${hint}`,
      CANVAS_WIDTH / 2, y + panelH - 18,
      { size: uiSize(12), align: 'center', color: COLOR.textMuted, family: FONT_BODY });
  }

  handleInput(action) {
    if (!this.open) return false;
    if (action.type === 'escape') {
      this.hide();
      return true;
    }
    if (action.type === 'pointer' || action.type === 'tap' || action.type === 'confirm'
        || action.type === 'wait') {
      this._advance();
      return true;
    }
    return true;
  }

  _advance() {
    if (this._step < STEPS.length - 1) {
      this._step += 1;
      return;
    }
    this.hide();
  }
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

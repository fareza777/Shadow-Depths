/**
 * TutorialOverlay — 3-step first-run hints (move, attack, pickup).
 * Centered modal so it never hides the control band. D-pad moves dismiss it.
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
    body: 'PICK gathers items. DOWN uses stairs. BAG opens inventory. Tap or press any direction to continue.'
  }
];

export class TutorialOverlay {
  /**
   * @param {{ metaProgress?: { setSetting: Function } }} deps
   */
  constructor({ metaProgress, bus } = {}) {
    this.meta = metaProgress || null;
    this.bus = bus || null;
    this.open = false;
    this._step = 0;
    if (this.bus) {
      this.bus.on('request:newRun', () => this.hide());
      this.bus.on('scene:switched', ({ to }) => {
        if (to !== 'game') this.hide();
      });
    }
  }

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
    const panelW = CANVAS_WIDTH - 32;
    const panelH = 200;
    const x = 16;
    const y = Math.floor((CANVAS_HEIGHT - panelH) / 2) - 40;

    r.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(0,0,0,0.62)');
    r.drawRect(x, y, panelW, panelH, COLOR.bgPanel);
    r.drawStrokedRect(x, y, panelW, panelH, COLOR.gold, 2);
    r.drawRect(x, y, panelW, 3, COLOR.gold);

    r.drawText('FIRST RUN', CANVAS_WIDTH / 2, y + 22,
      { size: uiSize(11), align: 'center', color: COLOR.textMuted, family: FONT_BODY });
    r.drawText(step.title, CANVAS_WIDTH / 2, y + 50,
      { size: uiSize(20), bold: true, align: 'center', color: COLOR.gold, family: FONT_DISPLAY });

    const lines = wrapText(step.body, 36);
    let ly = y + 82;
    for (const line of lines) {
      r.drawText(line, CANVAS_WIDTH / 2, ly,
        { size: uiSize(13), align: 'center', color: COLOR.textPrimary, family: FONT_BODY });
      ly += uiSize(16);
    }

    const hint = this._step < STEPS.length - 1 ? 'Tap or use D-pad to continue' : 'Tap or move to play';
    r.drawText(`${this._step + 1} / ${STEPS.length}  ·  ${hint}`,
      CANVAS_WIDTH / 2, y + panelH - 20,
      { size: uiSize(12), align: 'center', color: COLOR.textMuted, family: FONT_BODY });
    r.drawText('SKIP', CANVAS_WIDTH / 2, y + panelH + 14,
      { size: uiSize(11), align: 'center', color: COLOR.goldDim, family: FONT_BODY });
  }

  handleInput(action) {
    if (!this.open) return false;
    if (action.type === 'escape' || action.type === 'menu') {
      this.hide();
      return true;
    }
    if (action.type === 'move' || action.type === 'wait' || action.type === 'confirm'
        || action.type === 'pickup' || action.type === 'inventory') {
      this._advance();
      return false;
    }
    if (action.type === 'pointer' || action.type === 'tap') {
      this._advance();
      return true;
    }
    return false;
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

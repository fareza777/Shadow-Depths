/**
 * TutorialOverlay — 3-step first-run hints (move, attack, pickup).
 * Centered modal so it never hides the control band. D-pad moves dismiss it.
 */
import { CANVAS_WIDTH, COLOR, FONT_DISPLAY, FONT_BODY, uiSize } from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { getViewportBottomY } from './controlBandLayout.js';

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
    body: 'Use the QUICK row: PICK, BAG, HERO. DOWN (right) uses stairs to the next floor.'
  },
  {
    title: 'FORGE & DEPTH',
    body: 'Materials go to a pouch. Open BAG → POUCH to review them. On forge sanctuary floors, PICK calls the smith.'
  }
];

const KEEPER_STEPS = [
  {
    title: 'THE KEEPER',
    body: 'Welcome to a two-floor lesson. Move one tile at a time, keep the lantern circle around you, and use PICK beside glowing objects.'
  },
  {
    title: 'READ THE ROOM',
    body: 'Gold glows mark people or shrines. Blue cracks, bones, banners, and torches are landmarks that help you remember each room.'
  },
  {
    title: 'FIRST FIGHT',
    body: 'Step next to an enemy and tap it, or walk into it, to attack. Back away when low HP and use your quick row for consumables.'
  },
  {
    title: 'LOOT & EQUIP',
    body: 'Stand on loot and press PICK. Open BAG to equip better gear; your hero silhouette changes as armor and weapons improve.'
  },
  {
    title: 'DESCEND',
    body: 'Find the stair sigil, stand on it, then press DOWN. The second tutorial floor ends the lesson and returns you ready for a real descent.'
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
    this._variant = 'firstRun';
    if (this.bus) {
      this.bus.on('request:newRun', () => this.hide());
      this.bus.on('scene:switched', ({ to }) => {
        if (to !== 'game') this.hide();
      });
    }
  }

  show(show = true) {
    this._variant = show === 'keeper' ? 'keeper' : 'firstRun';
    this.open = !!show;
    this._step = 0;
  }

  hide() {
    this.open = false;
    if (this.meta) this.meta.setSetting('showTutorial', false);
  }

  render(renderer) {
    if (!this.open) return;
    const steps = this._variant === 'keeper' ? KEEPER_STEPS : STEPS;
    const step = steps[this._step] || steps[steps.length - 1];
    const r = renderer;
    const compact = this._variant === 'keeper';
    const panelW = Layout.canvasW - (compact ? 20 : 32);
    const panelH = compact ? 88 : 200;
    const x = compact ? 10 : 16;
    const y = compact ? Math.max(104, getViewportBottomY() - panelH - 10)
      : Math.floor((Layout.canvasH - panelH) / 2) - 40;

    if (!compact) r.drawRect(0, 0, Layout.canvasW, getViewportBottomY(), 'rgba(0,0,0,0.55)');
    r.drawRect(x, y, panelW, panelH, compact ? '#1c1822' : COLOR.bgPanel);
    r.drawStrokedRect(x, y, panelW, panelH, COLOR.gold, compact ? 1 : 2);
    r.drawRect(x, y, panelW, 3, COLOR.gold);

    r.drawText(this._variant === 'keeper' ? 'GUIDED TUTORIAL' : 'FIRST RUN', CANVAS_WIDTH / 2, y + (compact ? 14 : 22),
      { size: uiSize(compact ? 9 : 11), align: 'center', color: COLOR.textMuted, family: FONT_BODY });
    r.drawText(step.title, Layout.canvasW / 2, y + (compact ? 32 : 50),
      { size: uiSize(compact ? 15 : 20), bold: true, align: 'center', color: COLOR.gold, family: FONT_DISPLAY });

    const lines = wrapText(step.body, compact ? 54 : 36).slice(0, compact ? 2 : 5);
    let ly = y + (compact ? 50 : 82);
    for (const line of lines) {
      r.drawText(line, Layout.canvasW / 2, ly,
        { size: uiSize(compact ? 10 : 13), align: 'center', color: COLOR.textPrimary, family: FONT_BODY });
      ly += uiSize(compact ? 12 : 16);
    }

    const hint = this._step < steps.length - 1 ? 'Tap or use D-pad to continue' : 'Tap or move to play';
    if (compact) {
      r.drawText(`${this._step + 1}/${steps.length}`,
        x + panelW - 14, y + 12,
        { size: uiSize(9), align: 'right', color: COLOR.textMuted, family: FONT_BODY });
    } else {
      r.drawText(`${this._step + 1} / ${steps.length}  ·  ${hint}`,
        Layout.canvasW / 2, y + panelH - 20,
        { size: uiSize(12), align: 'center', color: COLOR.textMuted, family: FONT_BODY });
      r.drawText('SKIP', Layout.canvasW / 2, y + panelH + 14,
        { size: uiSize(11), align: 'center', color: COLOR.goldDim, family: FONT_BODY });
    }
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
    const steps = this._variant === 'keeper' ? KEEPER_STEPS : STEPS;
    if (this._step < steps.length - 1) {
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

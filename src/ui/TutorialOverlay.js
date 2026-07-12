/**
 * TutorialOverlay — 3-step first-run hints (move, attack, pickup).
 * Centered modal so it never hides the control band. D-pad moves dismiss it.
 */
import { COLOR, FONT_DISPLAY, FONT_BODY, uiSize } from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { getViewportBottomY } from './controlBandLayout.js';
import { t } from '../content/i18n.js';

const STEPS = [
  { titleKey: 'tutorial.step_move_t', bodyKey: 'tutorial.step_move_b' },
  { titleKey: 'tutorial.step_attack_t', bodyKey: 'tutorial.step_attack_b' },
  { titleKey: 'tutorial.step_loot_t', bodyKey: 'tutorial.step_loot_b' },
  { titleKey: 'tutorial.step_forge_t', bodyKey: 'tutorial.step_forge_b' }
];

const KEEPER_STEPS = [
  { titleKey: 'tutorial.keeper_welcome_t', bodyKey: 'tutorial.keeper_welcome_b' },
  { titleKey: 'tutorial.keeper_room_t', bodyKey: 'tutorial.keeper_room_b' },
  { titleKey: 'tutorial.keeper_fight_t', bodyKey: 'tutorial.keeper_fight_b' },
  { titleKey: 'tutorial.keeper_loot_t', bodyKey: 'tutorial.keeper_loot_b' },
  { titleKey: 'tutorial.keeper_down_t', bodyKey: 'tutorial.keeper_down_b' }
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
    const raw = steps[this._step] || steps[steps.length - 1];
    const step = {
      title: t(raw.titleKey),
      body: t(raw.bodyKey)
    };
    const r = renderer;
    const compact = this._variant === 'keeper';
    const panelW = Layout.canvasW - (compact ? 20 : 32);
    const panelH = compact ? 110 : 200;
    const x = compact ? 10 : 16;
    const y = compact ? Math.max(104, getViewportBottomY() - panelH - 10)
      : Math.floor((Layout.canvasH - panelH) / 2) - 40;

    if (!compact) r.drawRect(0, 0, Layout.canvasW, getViewportBottomY(), 'rgba(0,0,0,0.55)');
    r.drawRect(x, y, panelW, panelH, compact ? '#1c1822' : COLOR.bgPanel);
    r.drawStrokedRect(x, y, panelW, panelH, COLOR.gold, compact ? 1 : 2);
    r.drawRect(x, y, panelW, 3, COLOR.gold);

    // Eyebrow (left) + step counter (right) on the same header line.
    const eyebrow = this._variant === 'keeper'
      ? t('tutorial.eyebrow_keeper')
      : t('tutorial.eyebrow');
    const headY = y + (compact ? 15 : 22);
    r.drawText(eyebrow, x + 12, headY,
      { size: uiSize(compact ? 9 : 11), align: 'left', color: COLOR.textMuted, family: FONT_BODY });
    r.drawText(`STEP ${this._step + 1} / ${steps.length}`, x + panelW - 12, headY,
      { size: uiSize(compact ? 9 : 11), align: 'right', color: COLOR.gold, family: FONT_BODY });

    r.drawText(step.title, Layout.canvasW / 2, y + (compact ? 33 : 50),
      { size: uiSize(compact ? 15 : 20), bold: true, align: 'center', color: COLOR.gold, family: FONT_DISPLAY });

    const lines = wrapText(step.body, compact ? 50 : 36).slice(0, compact ? 3 : 5);
    let ly = y + (compact ? 49 : 82);
    for (const line of lines) {
      r.drawText(line, Layout.canvasW / 2, ly,
        { size: uiSize(compact ? 10 : 13), align: 'center', color: COLOR.textPrimary, family: FONT_BODY });
      ly += uiSize(compact ? 12 : 16);
    }

    // Always-visible call to action so the player knows how to proceed.
    const last = this._step >= steps.length - 1;
    const hint = last ? t('tutorial.begin') : t('tutorial.continue');
    if (compact) {
      r.drawText(hint, Layout.canvasW / 2, y + panelH - 12,
        { size: uiSize(10), align: 'center', color: COLOR.goldDim, family: FONT_BODY });
    } else {
      r.drawText(hint, Layout.canvasW / 2, y + panelH - 20,
        { size: uiSize(12), align: 'center', color: COLOR.textMuted, family: FONT_BODY });
      r.drawText(t('tutorial.skip'), Layout.canvasW / 2, y + panelH + 14,
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

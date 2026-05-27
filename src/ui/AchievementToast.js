/**
 * AchievementToast — small slide-in banner on achievement:unlocked.
 *
 * Lives at top-right of the canvas. Queues up so simultaneous unlocks
 * stack. Auto-fades after the display duration.
 */
import { CANVAS_WIDTH, FONT_DISPLAY, FONT_BODY, uiSize, COLOR } from '../config/constants.js';
import { IRON } from './ironHud.js';

const BRASS = '#d4ac6c';
const BRASS_HI = '#f1d49a';
const DISPLAY_MS = 3200;
const FADE_MS = 600;

export class AchievementToast {
  constructor({ bus }) {
    this.bus = bus;
    /** @type {Array<{ def:object, t0:number }>} */
    this.queue = [];
    if (this.bus) {
      this.bus.on('achievement:unlocked', ({ def }) => {
        if (!def) return;
        this.queue.push({ def, t0: performance.now() });
      });
    }
  }

  update() {
    const now = performance.now();
    this.queue = this.queue.filter((t) => now - t.t0 < DISPLAY_MS);
  }

  render(renderer) {
    if (this.queue.length === 0) return;
    this.update();
    const now = performance.now();
    const ctx = renderer.ctx;
    const w = 220;
    const h = 56;
    const padX = 12;
    const startY = 12;
    const gap = 8;

    for (let i = 0; i < this.queue.length; i++) {
      const toast = this.queue[i];
      const age = now - toast.t0;
      // Slide-in over first 250 ms, hold, fade in last FADE_MS.
      const slideT = Math.min(1, age / 250);
      let alpha = 1;
      if (age > DISPLAY_MS - FADE_MS) {
        alpha = Math.max(0, 1 - (age - (DISPLAY_MS - FADE_MS)) / FADE_MS);
      }
      const slideOffset = (1 - slideT) * 24;
      const x = CANVAS_WIDTH - w - padX + slideOffset;
      const y = startY + i * (h + gap);

      ctx.save();
      ctx.globalAlpha = alpha;
      // Plate
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, IRON.plate1);
      g.addColorStop(1, IRON.plate0);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // Brass border
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      // Glow
      ctx.shadowColor = BRASS;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = BRASS;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.shadowBlur = 0;

      // Trophy glyph
      renderer.drawText('★', x + 14, y + h / 2, {
        size: uiSize(22), bold: true, align: 'center', baseline: 'middle',
        family: FONT_DISPLAY, color: BRASS_HI
      });
      // Tagline
      renderer.drawText('ACHIEVEMENT', x + 32, y + 12, {
        size: uiSize(9), align: 'left',
        family: FONT_DISPLAY, color: COLOR.textMuted
      });
      // Name
      renderer.drawText(toast.def.name, x + 32, y + 26, {
        size: uiSize(13), bold: true, align: 'left',
        family: FONT_DISPLAY, color: BRASS_HI
      });
      // Reward
      if (toast.def.reward?.coins) {
        renderer.drawText(`+${toast.def.reward.coins} ◈`, x + w - 8, y + h - 14, {
          size: uiSize(11), align: 'right', bold: true,
          family: FONT_BODY, color: BRASS
        });
      }
      ctx.restore();
    }
  }
}

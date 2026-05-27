/**
 * OpeningCinematic - short story intro before a fresh descent.
 *
 * This is code-rendered rather than a video so it stays tiny for PlayStore
 * builds, scales with portrait/landscape, and can be skipped instantly.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { HERO_DEFS } from '../rendering/heroSprites.js';
import { drawSpacedText, IRON_PALETTE } from './ironPanel.js';

const TOTAL_DURATION = 40;

const STORY_BEATS = [
  {
    at: 1.0,
    title: 'BEFORE THE DESCENT',
    body: 'Before the first kingdom burned, the depths were already awake.'
  },
  {
    at: 8.8,
    title: 'THE GATE REMEMBERS',
    body: 'Every stair was sealed once. Every seal was broken from below.'
  },
  {
    at: 16.8,
    title: 'A VIGIL IS CALLED',
    body: 'One lantern crosses the threshold. The dark answers with a hundred floors.'
  },
  {
    at: 24.9,
    title: 'NO SONG RETURNS',
    body: 'Names are carved into iron. Footsteps vanish under stone.'
  },
  {
    at: 32.8,
    title: 'DESCEND',
    body: 'Steel, ash, and breath. There is no rescue beneath the first door.'
  }
];

export class OpeningCinematic {
  /** @param {{ bus: object, runOptions?: object }} deps */
  constructor({ bus, runOptions = {} }) {
    this.bus = bus;
    this.runOptions = runOptions;
    this.t = 0;
    this.finished = false;
    this._spokenBeatIndex = -1;
    this._embers = OpeningCinematic._seedEmbers();
  }

  enter(ctx = {}) {
    this.t = 0;
    this.finished = false;
    this._spokenBeatIndex = -1;
    this.runOptions = ctx.runOptions || this.runOptions || {};
  }

  exit() {
    this._stopNarration();
  }

  update(dt) {
    this.t += dt;
    this._updateNarration();
    for (const ember of this._embers) {
      ember.life += dt;
      ember.y -= ember.speed * dt;
      ember.x += Math.sin(this.t * 1.2 + ember.phase) * 8 * dt;
      if (ember.y < -12 || ember.life > ember.duration) {
        ember.x = Math.random() * CANVAS_WIDTH;
        ember.y = CANVAS_HEIGHT + 12;
        ember.life = 0;
        ember.duration = 4 + Math.random() * 4;
      }
    }
    if (this.t >= TOTAL_DURATION) this._finish();
  }

  render(renderer) {
    const r = renderer;
    const ctx = r.ctx;
    const w = Layout.canvasW || CANVAS_WIDTH;
    const h = Layout.canvasH || CANVAS_HEIGHT;
    const p = Math.min(1, this.t / TOTAL_DURATION);

    this._drawBackdrop(r, w, h, p);
    this._drawGate(r, w, h, p);
    this._drawHero(r, w, h, p);
    this._drawStoryText(r, w, h);
    this._drawSkip(r, w, h);

    const fadeIn = 1 - OpeningCinematic._smooth(this.t, 0, 0.8);
    const fadeOut = OpeningCinematic._smooth(this.t, TOTAL_DURATION - 0.9, TOTAL_DURATION);
    const fade = Math.max(fadeIn, fadeOut);
    if (fade > 0) {
      ctx.save();
      ctx.globalAlpha = fade;
      r.drawRect(0, 0, w, h, '#000');
      ctx.restore();
    }
  }

  handleInput(action) {
    if (!action) return;
    if (this.t < 0.25) return;
    if (['confirm', 'pickup', 'tap', 'pointer', 'escape', 'inventory', 'move'].includes(action.type)) {
      this._finish();
    }
  }

  _finish() {
    if (this.finished) return;
    this.finished = true;
    this._stopNarration();
    this.bus.emit('request:startRunNow', {
      ...this.runOptions,
      skipIntro: true
    });
  }

  _drawBackdrop(r, w, h, progress) {
    const ctx = r.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#21182b');
    g.addColorStop(0.48, '#08060d');
    g.addColorStop(1, '#020104');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let y = 24; y < h; y += 42) {
      r.drawRect(0, y, w, 1, '#d4ac6c22');
    }
    ctx.restore();

    ctx.save();
    for (const ember of this._embers) {
      const a = Math.sin((ember.life / ember.duration) * Math.PI) * ember.alpha;
      ctx.globalAlpha = Math.max(0, a);
      ctx.shadowColor = ember.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = ember.color;
      ctx.fillRect(ember.x, ember.y, ember.size, ember.size);
    }
    ctx.restore();

    const pulse = 0.18 + Math.sin(progress * Math.PI) * 0.24;
    ctx.save();
    ctx.globalAlpha = pulse;
    const rg = ctx.createRadialGradient(w / 2, h * 0.42, 12, w / 2, h * 0.42, Math.max(w, h) * 0.54);
    rg.addColorStop(0, '#d4ac6c');
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  _drawGate(r, w, h, progress) {
    const ctx = r.ctx;
    const cx = w / 2;
    const gateW = IS_LANDSCAPE ? 210 : 260;
    const gateH = IS_LANDSCAPE ? 150 : 300;
    const y = IS_LANDSCAPE ? h * 0.2 : h * 0.18;
    const open = OpeningCinematic._smooth(progress, 0.36, 0.92);
    const slit = 8 + open * gateW * 0.56;
    const doorShift = open * gateW * 0.16;
    const doorTop = y + gateH * 0.22;
    const doorH = gateH * 0.76;

    ctx.save();
    ctx.globalAlpha = 0.95;
    const archG = ctx.createLinearGradient(0, y, 0, y + gateH);
    archG.addColorStop(0, '#3b3140');
    archG.addColorStop(0.45, '#17111c');
    archG.addColorStop(1, '#07050a');
    ctx.fillStyle = archG;
    ctx.fillRect(cx - gateW / 2, y + gateH * 0.18, gateW, gateH * 0.82);
    ctx.beginPath();
    ctx.arc(cx, y + gateH * 0.2, gateW / 2, Math.PI, 0);
    ctx.lineTo(cx + gateW / 2, y + gateH * 0.24);
    ctx.lineTo(cx - gateW / 2, y + gateH * 0.24);
    ctx.closePath();
    ctx.fill();

    // Premium outer gate frame: broad stone sides with restrained brass trim.
    ctx.shadowColor = 'rgba(212,172,108,0.35)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = IRON_PALETTE.brass;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - gateW / 2, y + gateH * 0.2, gateW, gateH * 0.8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0d0a10';
    ctx.fillRect(cx - gateW / 2 - 12, doorTop - 8, 12, doorH + 16);
    ctx.fillRect(cx + gateW / 2, doorTop - 8, 12, doorH + 16);
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.fillRect(cx - gateW / 2 - 8, doorTop - 2, 2, doorH + 4);
    ctx.fillRect(cx + gateW / 2 + 6, doorTop - 2, 2, doorH + 4);

    // Heavy twin-leaf gate sliding apart from the center.
    const leftDoorX = cx - gateW / 2 - doorShift;
    const rightDoorX = cx + slit / 2;
    const leafW = gateW / 2 - slit / 2;
    const drawLeaf = (x, flip = 1) => {
      const dg = ctx.createLinearGradient(0, doorTop, 0, doorTop + doorH);
      dg.addColorStop(0, '#342b38');
      dg.addColorStop(0.5, '#18121d');
      dg.addColorStop(1, '#08060b');
      ctx.fillStyle = dg;
      ctx.fillRect(x, doorTop, leafW + doorShift, doorH);
      ctx.strokeStyle = '#5a4a5f';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, doorTop + 0.5, leafW + doorShift - 1, doorH - 1);
      ctx.strokeStyle = IRON_PALETTE.brass;
      ctx.globalAlpha = 0.82;
      ctx.strokeRect(x + 8.5, doorTop + 12.5, leafW + doorShift - 17, doorH - 25);
      ctx.globalAlpha = 0.95;
      for (let i = 0; i < 6; i++) {
        const sy = doorTop + 18 + i * (doorH - 36) / 5;
        const sx = x + (flip > 0 ? leafW + doorShift - 14 : 12);
        ctx.fillStyle = '#d4ac6c';
        ctx.fillRect(sx, sy, 3, 3);
      }
      const emblemX = x + (flip > 0 ? leafW + doorShift - 28 : 28);
      const emblemY = doorTop + doorH * 0.43;
      ctx.save();
      ctx.translate(emblemX, emblemY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#0a0710';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeStyle = IRON_PALETTE.brass;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
    };
    drawLeaf(leftDoorX, 1);
    drawLeaf(rightDoorX + doorShift, -1);

    // Portcullis rises slowly as the seal breaks.
    const barsTop = doorTop - open * 46;
    ctx.fillStyle = '#100b13';
    ctx.fillRect(cx - gateW * 0.38, barsTop, gateW * 0.76, 8);
    ctx.fillStyle = '#8a6c42';
    for (let i = 0; i < 7; i++) {
      const bx = cx - gateW * 0.32 + i * gateW * 0.106;
      ctx.fillRect(bx, barsTop + 2, 4, doorH * 0.72);
      ctx.beginPath();
      ctx.moveTo(bx, barsTop + doorH * 0.72 + 2);
      ctx.lineTo(bx + 4, barsTop + doorH * 0.72 + 2);
      ctx.lineTo(bx + 2, barsTop + doorH * 0.72 + 12);
      ctx.closePath();
      ctx.fill();
    }

    const light = ctx.createLinearGradient(cx - slit, 0, cx + slit, 0);
    light.addColorStop(0, 'rgba(212,172,108,0)');
    light.addColorStop(0.5, 'rgba(241,212,154,0.78)');
    light.addColorStop(1, 'rgba(212,172,108,0)');
    ctx.fillStyle = light;
    ctx.fillRect(cx - slit, y + gateH * 0.22, slit * 2, gateH * 0.78);

    // Clean central aura as the gate opens.
    ctx.globalAlpha = 0.22 + open * 0.34;
    ctx.strokeStyle = '#f1d49a';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - gateW * 0.18, doorTop + doorH * 0.26, gateW * 0.36, doorH * 0.34);

    // Light blades projected onto the floor.
    ctx.globalAlpha = open * 0.26;
    for (let i = 0; i < 4; i++) {
      const ray = ctx.createLinearGradient(cx, doorTop, cx + (i - 1.5) * 52, doorTop + doorH);
      ray.addColorStop(0, 'rgba(241,212,154,0.5)');
      ray.addColorStop(1, 'rgba(241,212,154,0)');
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(cx - slit * 0.08, doorTop + 10);
      ctx.lineTo(cx + (i - 2) * 58, doorTop + doorH + 60);
      ctx.lineTo(cx + (i - 1) * 58, doorTop + doorH + 60);
      ctx.lineTo(cx + slit * 0.08, doorTop + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  _drawHero(r, w, h, progress) {
    const ctx = r.ctx;
    const kind = this.runOptions.heroKind || 'vigil';
    const def = HERO_DEFS[kind] || HERO_DEFS.vigil;
    const size = IS_LANDSCAPE ? 76 : 96;
    const x = w / 2 - size / 2;
    const y = IS_LANDSCAPE ? h * 0.54 : h * 0.56;
    const a = OpeningCinematic._smooth(progress, 0.48, 0.78);
    const bob = Math.sin(this.t * 1.45) * 3;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = '#d4ac6c';
    ctx.shadowBlur = 22;
    r.sprites.draw(`portrait_${def.kind || kind}`, ctx, x, y + bob, { size });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(w / 2, y + size + 10, size * 0.42, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawStoryText(r, w, h) {
    const beat = [...STORY_BEATS].reverse().find((b) => this.t >= b.at) || STORY_BEATS[0];
    const next = STORY_BEATS.find((b) => b.at > beat.at) || { at: TOTAL_DURATION };
    const localIn = OpeningCinematic._smooth(this.t, beat.at, beat.at + 0.85);
    const localOut = 1 - OpeningCinematic._smooth(this.t, next.at - 0.75, next.at);
    const alpha = Math.min(localIn, localOut);
    const titleY = IS_LANDSCAPE ? h * 0.12 : h * 0.11;
    const bodyY = IS_LANDSCAPE ? h * 0.78 : h * 0.76;

    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${uiSize(IS_LANDSCAPE ? 18 : 24)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = IRON_PALETTE.brass;
    drawSpacedText(ctx, beat.title, w / 2, titleY, 3);
    ctx.restore();

    this._drawWrappedCentered(r, beat.body, w / 2, bodyY, Math.min(w - 48, 440), {
      alpha,
      size: uiSize(IS_LANDSCAPE ? 12 : 15)
    });

    if (this.t > TOTAL_DURATION - 4.2) {
      const a = OpeningCinematic._smooth(this.t, TOTAL_DURATION - 4.2, TOTAL_DURATION - 1.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `bold ${uiSize(IS_LANDSCAPE ? 24 : 32)}px ${FONT_DISPLAY}`;
      ctx.fillStyle = '#fff5d0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawSpacedText(ctx, 'SHADOW DEPTHS', w / 2, h * 0.43, 3);
      ctx.restore();
    }
  }

  _drawWrappedCentered(r, text, cx, y, maxW, opts) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    const textOpts = {
      size: opts.size,
      family: FONT_BODY,
      italic: true,
      color: IRON_PALETTE.bone
    };
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (r.measureText(next, textOpts) <= maxW) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);

    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = opts.alpha;
    for (let i = 0; i < lines.length; i++) {
      r.drawText(lines[i], cx, y + i * uiSize(20), {
        ...textOpts,
        align: 'center',
        baseline: 'middle'
      });
    }
    ctx.restore();
  }

  _drawSkip(r, w, h) {
    const alpha = OpeningCinematic._smooth(this.t, 1.0, 1.6);
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = alpha * 0.72;
    r.drawText('tap to skip', w / 2, h - 28, {
      size: uiSize(11),
      align: 'center',
      family: FONT_MONO,
      color: IRON_PALETTE.boneDim
    });
    ctx.restore();
  }

  static _smooth(v, a, b) {
    const t = Math.max(0, Math.min(1, (v - a) / Math.max(0.0001, b - a)));
    return t * t * (3 - 2 * t);
  }

  _updateNarration() {
    const index = this._activeBeatIndex();
    if (index < 0 || index === this._spokenBeatIndex) return;
    this._spokenBeatIndex = index;
    this._speakBeat(STORY_BEATS[index]);
  }

  _activeBeatIndex() {
    let active = -1;
    for (let i = 0; i < STORY_BEATS.length; i++) {
      if (this.t >= STORY_BEATS[i].at) active = i;
      else break;
    }
    return active;
  }

  _speakBeat(beat) {
    try {
      const synth = globalThis.speechSynthesis;
      const Utterance = globalThis.SpeechSynthesisUtterance;
      if (!synth || !Utterance) return;
      synth.cancel();
      const utterance = new Utterance(`${beat.title}. ${beat.body}`);
      utterance.lang = 'en-US';
      utterance.rate = 0.7;
      utterance.pitch = 0.78;
      utterance.volume = 0.85;
      synth.speak(utterance);
      this._utterance = utterance;
    } catch {
      this._utterance = null;
    }
  }

  _stopNarration() {
    try {
      if (this._utterance && globalThis.speechSynthesis) {
        globalThis.speechSynthesis.cancel();
      }
    } catch {
      // Voice narration is best-effort; visuals must never depend on it.
    }
    this._utterance = null;
  }

  static _seedEmbers() {
    const colors = ['#f1d49a', '#d4ac6c', '#ff7a45'];
    return Array.from({ length: 28 }, (_, i) => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      speed: 18 + Math.random() * 34,
      size: 1 + Math.floor(Math.random() * 2),
      alpha: 0.25 + Math.random() * 0.55,
      duration: 4 + Math.random() * 4,
      life: Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
      color: colors[i % colors.length]
    }));
  }
}

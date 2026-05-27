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

const TOTAL_DURATION = 28;

const STORY_BEATS = [
  {
    at: 1.0,
    title: 'BEFORE THE DESCENT',
    body: 'Before the first kingdom burned, the depths were already awake.'
  },
  {
    at: 5.8,
    title: 'THE GATE REMEMBERS',
    body: 'Every stair was sealed once. Every seal was broken from below.'
  },
  {
    at: 10.8,
    title: 'A VIGIL IS CALLED',
    body: 'One lantern crosses the threshold. The dark answers with a hundred floors.'
  },
  {
    at: 15.9,
    title: 'NO SONG RETURNS',
    body: 'Names are carved into iron. Footsteps vanish under stone.'
  },
  {
    at: 20.8,
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
    const open = OpeningCinematic._smooth(progress, 0.32, 0.9);
    const slit = 8 + open * gateW * 0.48;

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#09060c';
    ctx.fillRect(cx - gateW / 2, y + gateH * 0.18, gateW, gateH * 0.82);
    ctx.beginPath();
    ctx.arc(cx, y + gateH * 0.2, gateW / 2, Math.PI, 0);
    ctx.lineTo(cx + gateW / 2, y + gateH * 0.24);
    ctx.lineTo(cx - gateW / 2, y + gateH * 0.24);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = IRON_PALETTE.brass;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - gateW / 2, y + gateH * 0.2, gateW, gateH * 0.8);

    const light = ctx.createLinearGradient(cx - slit, 0, cx + slit, 0);
    light.addColorStop(0, 'rgba(212,172,108,0)');
    light.addColorStop(0.5, 'rgba(241,212,154,0.65)');
    light.addColorStop(1, 'rgba(212,172,108,0)');
    ctx.fillStyle = light;
    ctx.fillRect(cx - slit, y + gateH * 0.22, slit * 2, gateH * 0.78);

    const runeAlpha = 0.25 + 0.4 * Math.sin(this.t * 1.35);
    ctx.globalAlpha = runeAlpha;
    ctx.strokeStyle = '#f1d49a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ry = y + gateH * 0.34 + i * gateH * 0.1;
      ctx.beginPath();
      ctx.arc(cx, ry, 14 + i * 8, 0, Math.PI * 2);
      ctx.stroke();
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
    r.drawText('tap to skip  ·  voice prologue', w / 2, h - 28, {
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

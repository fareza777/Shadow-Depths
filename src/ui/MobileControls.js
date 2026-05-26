/**
 * MobileControls — Iron Portcullis bottom HUD.
 *
 * Renders the wrought-iron control band that matches the reference
 * mock (iron-hud.jsx photo 1): hammered iron panel with brass-trimmed
 * corner gussets, perimeter rivet studs, horizontal seam strap between
 * rows, iron-lattice D-pad on the left, and a stack of AIM / CAST /
 * MENU / DOWN buttons on the right.
 *
 * QuickUseBar handles the top row (3 quick slots + HERO/BAG/PICK nav).
 * Minimap renders into the center cutout.
 */
import {
  FONT_DISPLAY, FONT_MONO, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { getDpadLayout, getQuickUseLayout } from './controlBandLayout.js';
import {
  IRON,
  drawIronPlate, drawIronLattice, drawBrassJewel,
  drawBrassPiping, drawPerimeterStuds, drawSeamStrap, drawCornerGusset,
  drawReticle, dirArrowGlyph, deltaToDir, drawIronRivet
} from './ironHud.js';

// Stacked action buttons on the right column.
//   AIM  — auto-target nearest visible enemy (ranged weapons primarily)
//   CAST — magic spell (no system yet — renders disabled "no spell")
//   MENU — pause overlay
//   DOWN — descend stairs (only enabled on stair tiles)
const ACTION_LABELS = [
  { key: 'aim',     label: 'AIM',  variant: 'aim' },
  { key: 'cast',    label: 'CAST', variant: 'cast' },
  { key: 'menu',    label: 'MENU', variant: 'side' },
  { key: 'descend', label: 'DOWN', variant: 'side' }
];

const DPAD_BUTTONS = [
  { col: 1, row: 0, dir: 'up',    emit: { type: 'move', dx: 0, dy: -1 } },
  { col: 0, row: 1, dir: 'left',  emit: { type: 'move', dx: -1, dy: 0 } },
  { col: 1, row: 1, dir: 'wait',  emit: { type: 'wait' } },
  { col: 2, row: 1, dir: 'right', emit: { type: 'move', dx: 1, dy: 0 } },
  { col: 1, row: 2, dir: 'down',  emit: { type: 'move', dx: 0, dy: 1 } }
];

/**
 * Compute the runtime layout — read from Layout (window-synced) so a
 * rotation or canvas resize is picked up without rebuilding the module.
 */
function buildLayout() {
  const dpad = getDpadLayout();
  const quick = getQuickUseLayout();
  const portrait = !dpad.isLandscape;
  const bandY = portrait ? dpad.bandY : Layout.hud;
  const bandH = portrait ? Layout.canvasH - bandY : Layout.canvasH - Layout.hud;

  // Right-stack action column geometry.
  let actX, actY, actW, actH, actGap, actStackH;
  if (portrait) {
    actW = 110;
    actGap = 5;
    actH = Math.floor((dpad.dpadSize - actGap * 3) / 4);
    actStackH = actH * 4 + actGap * 3;
    actX = Layout.canvasW - actW - 10;
    actY = dpad.dpadY;
  } else {
    actW = 116;
    actH = 36;
    actGap = 4;
    actStackH = actH * 4 + actGap * 3;
    actX = Layout.canvasW - dpad.stripW + (dpad.stripW - actW) / 2;
    actY = Layout.hud + 10;
  }

  // Center cutout — minimap slot between D-pad and action column.
  const centerRect = portrait
    ? {
        x: dpad.dpadX + dpad.dpadSize + 8,
        y: dpad.dpadY,
        w: actX - (dpad.dpadX + dpad.dpadSize) - 16,
        h: dpad.dpadSize
      }
    : {
        x: 6,
        y: dpad.dpadY + dpad.dpadSize + 10,
        w: dpad.stripW - 12,
        h: Layout.canvasH - (dpad.dpadY + dpad.dpadSize + 10) - 10
      };

  // Side bars (landscape only) and band (portrait only)
  const band = portrait ? { x: 0, y: bandY, w: Layout.canvasW, h: bandH } : null;
  const strips = portrait ? [] : [
    { x: 0, y: Layout.hud, w: dpad.stripW, h: bandH },
    { x: Layout.canvasW - dpad.stripW, y: Layout.hud, w: dpad.stripW, h: bandH }
  ];

  return {
    portrait, dpad, quick, band, strips,
    dpadBtn: dpad.dpadBtn, dpadGap: dpad.dpadGap, dpadSize: dpad.dpadSize,
    dpadX: dpad.dpadX, dpadY: dpad.dpadY,
    actX, actY, actW, actH, actGap, actStackH,
    centerRect
  };
}

/**
 * Per-action rects given a built LAYOUT. AIM + CAST are bigger (actH),
 * MENU + DOWN are smaller (32). Returns absolute positions for hit-test
 * and render to share.
 */
function actionRects(LAYOUT) {
  const out = [];
  let y = LAYOUT.actY;
  out.push({ ...ACTION_LABELS[0], x: LAYOUT.actX, y, w: LAYOUT.actW, h: LAYOUT.actH });
  y += LAYOUT.actH + LAYOUT.actGap;
  out.push({ ...ACTION_LABELS[1], x: LAYOUT.actX, y, w: LAYOUT.actW, h: LAYOUT.actH });
  y += LAYOUT.actH + LAYOUT.actGap;
  out.push({ ...ACTION_LABELS[2], x: LAYOUT.actX, y, w: LAYOUT.actW, h: LAYOUT.actH });
  y += LAYOUT.actH + LAYOUT.actGap;
  out.push({ ...ACTION_LABELS[3], x: LAYOUT.actX, y, w: LAYOUT.actW, h: LAYOUT.actH });
  return out;
}

export class MobileControls {
  constructor({ bus }) {
    this.bus = bus;
    this._currentScene = 'title';
    this._pressedKey = null;
    this._pressedClearedAt = 0;
    /** Optional per-frame context set by GameScene before render. */
    this._ctx = null;
    bus.on('scene:switched', ({ to }) => { this._currentScene = to; });
    bus.on('tick', ({ time }) => {
      if (this._pressedKey && time > this._pressedClearedAt) this._pressedKey = null;
    });
  }

  /**
   * GameScene sets player + floor + canDescend each frame so AIM/CAST/DOWN
   * can compute their enabled / target state.
   */
  setContext(ctx) { this._ctx = ctx; }

  render(renderer) {
    if (this._currentScene !== 'game') return;
    this.renderBackground(renderer);
    this.renderControls(renderer);
  }

  /**
   * Paint the wrought-iron panel chrome (band, gussets, studs, seam).
   * Called BEFORE quick slots / minimap so they sit on top of the iron.
   */
  renderBackground(renderer) {
    if (this._currentScene !== 'game') return;
    const LAYOUT = buildLayout();
    this._renderPanel(renderer, LAYOUT);
  }

  /**
   * Paint the interactive controls (D-pad arms, brass center jewel, AIM /
   * CAST / MENU / DOWN stack). Called AFTER quick slots so the controls
   * sit on top of any background art.
   */
  renderControls(renderer) {
    if (this._currentScene !== 'game') return;
    const LAYOUT = buildLayout();
    this._renderDpad(renderer, LAYOUT);
    this._renderActionStack(renderer, LAYOUT);
  }

  /**
   * Hit-test. Returns true when a button consumed the tap so the world
   * tap-to-walk path is skipped.
   */
  handleTap(canvasX, canvasY, currentTime) {
    if (this._currentScene !== 'game') return false;
    const LAYOUT = buildLayout();
    const hitPad = LAYOUT.portrait ? 7 : 2;

    // D-pad buttons.
    for (const b of DPAD_BUTTONS) {
      const bx = LAYOUT.dpadX + b.col * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const by = LAYOUT.dpadY + b.row * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      if (canvasX >= bx - hitPad && canvasX <= bx + LAYOUT.dpadBtn + hitPad &&
          canvasY >= by - hitPad && canvasY <= by + LAYOUT.dpadBtn + hitPad) {
        this._flash(`dpad:${b.dir}`, currentTime);
        this.bus.emit('input:action', b.emit);
        return true;
      }
    }

    // Action stack.
    const acts = actionRects(LAYOUT);
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      if (canvasX >= a.x && canvasX <= a.x + a.w &&
          canvasY >= a.y && canvasY <= a.y + a.h) {
        // Gate disabled buttons (CAST without spell, DOWN without stairs).
        if (a.key === 'cast' && !this._ctx?.castReady) {
          this._flash(`act:${a.key}`, currentTime);
          return true;
        }
        if (a.key === 'descend' && !this._ctx?.canDescend) {
          this._flash(`act:${a.key}`, currentTime);
          return true;
        }
        if (a.key === 'aim' && !this._ctx?.aimTarget) {
          this._flash(`act:${a.key}`, currentTime);
          return true;
        }
        this._flash(`act:${a.key}`, currentTime);
        // AIM is a special action: emit a custom action so GameScene can
        // execute the ranged attack against the cached aim target.
        if (a.key === 'aim') {
          this.bus.emit('input:action', { type: 'aim' });
        } else {
          this.bus.emit('input:action', { type: a.key });
        }
        return true;
      }
    }

    return false;
  }

  _flash(key, time) {
    this._pressedKey = key;
    this._pressedClearedAt = (time ?? performance.now() / 1000) + 0.12;
  }

  // --- panel chrome ----------------------------------------------------
  _renderPanel(r, LAYOUT) {
    const ctx = r.ctx;
    if (LAYOUT.band) {
      // Base dark fill with subtle vignette.
      const g = ctx.createLinearGradient(0, LAYOUT.band.y, 0, LAYOUT.band.y + LAYOUT.band.h);
      g.addColorStop(0, '#1f1820');
      g.addColorStop(0.45, '#120c14');
      g.addColorStop(0.75, '#0c080e');
      g.addColorStop(1, '#1a1218');
      ctx.fillStyle = g;
      ctx.fillRect(LAYOUT.band.x, LAYOUT.band.y, LAYOUT.band.w, LAYOUT.band.h);

      // Hammered iron noise overlay.
      MobileControls._drawHammered(ctx, LAYOUT.band);

      // Border + brass piping.
      ctx.fillStyle = IRON.ink;
      ctx.fillRect(LAYOUT.band.x, LAYOUT.band.y, LAYOUT.band.w, 3);
      drawBrassPiping(ctx, LAYOUT.band.x + 24, LAYOUT.band.y + 11, LAYOUT.band.w - 48);
      drawBrassPiping(ctx, LAYOUT.band.x + 24, LAYOUT.band.y + LAYOUT.band.h - 11,
        LAYOUT.band.w - 48);

      // Perimeter studs (top + bottom).
      drawPerimeterStuds(ctx, LAYOUT.band, 'top', 7);
      drawPerimeterStuds(ctx, LAYOUT.band, 'bottom', 7);
      drawPerimeterStuds(ctx, LAYOUT.band, 'left', 5);
      drawPerimeterStuds(ctx, LAYOUT.band, 'right', 5);

      // Corner gussets.
      const gz = 26;
      drawCornerGusset(ctx, LAYOUT.band.x + 6, LAYOUT.band.y + 6, gz, gz, 'tl');
      drawCornerGusset(ctx, LAYOUT.band.x + LAYOUT.band.w - gz - 6, LAYOUT.band.y + 6, gz, gz, 'tr');
      drawCornerGusset(ctx, LAYOUT.band.x + 6, LAYOUT.band.y + LAYOUT.band.h - gz - 6, gz, gz, 'bl');
      drawCornerGusset(ctx, LAYOUT.band.x + LAYOUT.band.w - gz - 6, LAYOUT.band.y + LAYOUT.band.h - gz - 6, gz, gz, 'br');

      // Seam strap between top quick-slot row and D-pad row.
      const seamY = LAYOUT.dpadY - 10;
      drawSeamStrap(ctx, LAYOUT.band.x + 12, seamY, LAYOUT.band.w - 24);
    }
    for (const s of LAYOUT.strips) {
      const g = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
      g.addColorStop(0, '#1f1820');
      g.addColorStop(1, '#0c080e');
      ctx.fillStyle = g;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      MobileControls._drawHammered(ctx, s);
      drawPerimeterStuds(ctx, s, 'top', 3);
      drawPerimeterStuds(ctx, s, 'bottom', 3);
    }
  }

  static _drawHammered(ctx, rect) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    for (const [px, py] of [
      [0.08, 0.18], [0.30, 0.12], [0.68, 0.22], [0.92, 0.38],
      [0.18, 0.48], [0.52, 0.62], [0.82, 0.78]
    ]) {
      const cx = rect.x + rect.w * px;
      const cy = rect.y + rect.h * py;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rect.w * 0.14);
      g.addColorStop(0, '#aaa0aa');
      g.addColorStop(1, 'rgba(170,160,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.globalAlpha = 0.30;
    for (const [px, py] of [[0.22, 0.86], [0.64, 0.90], [0.92, 0.12], [0.06, 0.70]]) {
      const cx = rect.x + rect.w * px;
      const cy = rect.y + rect.h * py;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rect.w * 0.18);
      g.addColorStop(0, 'rgba(15,10,15,0.6)');
      g.addColorStop(1, 'rgba(15,10,15,0)');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  // --- D-pad -----------------------------------------------------------
  _renderDpad(r, LAYOUT) {
    const ctx = r.ctx;
    const padX = LAYOUT.dpadX - 10;
    const padY = LAYOUT.dpadY - 10;
    const padS = LAYOUT.dpadSize + 20;
    this._drawDpadBackplate(ctx, padX, padY, padS, performance.now() / 1000);

    // Iron lattice behind buttons.
    drawIronLattice(ctx, LAYOUT.dpadX, LAYOUT.dpadY, LAYOUT.dpadSize);

    // Buttons.
    for (const b of DPAD_BUTTONS) {
      const bx = LAYOUT.dpadX + b.col * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const by = LAYOUT.dpadY + b.row * (LAYOUT.dpadBtn + LAYOUT.dpadGap);
      const pressed = this._pressedKey === `dpad:${b.dir}`;
      if (b.dir === 'wait') {
        // Brass center jewel for WAIT.
        const cx = bx + LAYOUT.dpadBtn / 2;
        const cy = by + LAYOUT.dpadBtn / 2;
        const r2 = LAYOUT.dpadBtn * 0.42;
        drawBrassJewel(ctx, cx, cy, r2, {
          pressed,
          variant: 'brass',
          glyph: '✷'
        });
      } else {
        drawIronPlate(ctx, bx, by, LAYOUT.dpadBtn, LAYOUT.dpadBtn, {
          pressed,
          glow: pressed ? IRON.ember : null
        });
        // Arrow glyph (bone color, ember when pressed).
        const cx = bx + LAYOUT.dpadBtn / 2;
        const cy = by + LAYOUT.dpadBtn / 2;
        const a = LAYOUT.dpadBtn * 0.24;
        ctx.fillStyle = pressed ? IRON.ember : IRON.bone;
        ctx.shadowColor = pressed ? `${IRON.ember}aa` : IRON.ink;
        ctx.shadowBlur = pressed ? 8 : 0;
        ctx.beginPath();
        if (b.dir === 'up') {
          ctx.moveTo(cx, cy - a); ctx.lineTo(cx - a, cy + a * 0.6); ctx.lineTo(cx + a, cy + a * 0.6);
        } else if (b.dir === 'down') {
          ctx.moveTo(cx, cy + a); ctx.lineTo(cx - a, cy - a * 0.6); ctx.lineTo(cx + a, cy - a * 0.6);
        } else if (b.dir === 'left') {
          ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a * 0.6, cy - a); ctx.lineTo(cx + a * 0.6, cy + a);
        } else {
          ctx.moveTo(cx + a, cy); ctx.lineTo(cx - a * 0.6, cy - a); ctx.lineTo(cx - a * 0.6, cy + a);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  _drawDpadBackplate(ctx, x, y, size, time) {
    ctx.save();
    const base = ctx.createLinearGradient(x, y, x, y + size);
    base.addColorStop(0, '#332b38');
    base.addColorStop(0.48, '#211a26');
    base.addColorStop(1, '#0d0a12');
    ctx.fillStyle = base;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = IRON.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    ctx.strokeStyle = '#5a5060';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 4.5, size - 9, size - 9);

    // Brass inner rail, so the D-pad reads as a mounted metal module.
    ctx.strokeStyle = 'rgba(122,94,52,0.72)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 7.5, y + 7.5, size - 15, size - 15);
    ctx.strokeStyle = 'rgba(241,212,154,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 10.5, y + 10.5, size - 21, size - 21);

    // Recessed square well just below the lattice, no pure black void.
    const wellPad = Math.round(size * 0.12);
    const wellX = x + wellPad;
    const wellY = y + wellPad;
    const wellS = size - wellPad * 2;
    const g = ctx.createRadialGradient(
      x + size / 2, y + size / 2, 8,
      x + size / 2, y + size / 2, size * 0.58
    );
    g.addColorStop(0, 'rgba(62,52,70,0.72)');
    g.addColorStop(0.58, 'rgba(36,30,42,0.62)');
    g.addColorStop(1, 'rgba(8,6,12,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(wellX, wellY, wellS, wellS);
    ctx.strokeStyle = IRON.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(wellX, wellY, wellS, wellS);

    // Plate seams and tiny hammered scratches matching the reference.
    ctx.globalAlpha = 0.36;
    ctx.strokeStyle = 'rgba(106,94,106,0.72)';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, y + 12);
    ctx.lineTo(x + size * 0.5, y + size - 12);
    ctx.moveTo(x + 12, y + size * 0.5);
    ctx.lineTo(x + size - 12, y + size * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 10; i++) {
      const sx = x + 18 + ((i * 31 + Math.sin(time + i) * 4) % Math.max(1, size - 36));
      const sy = y + 18 + ((i * 47) % Math.max(1, size - 36));
      ctx.fillStyle = i % 3 === 0 ? 'rgba(122,94,52,0.52)' : 'rgba(106,94,106,0.45)';
      ctx.fillRect(sx, sy, 14, 1);
      ctx.fillRect(sx + 4, sy + 5, 1, 8);
    }
    ctx.globalAlpha = 1;

    // More visible module rivets around the D-pad plate.
    const r = 3;
    const points = [
      [x + 8, y + 8], [x + size / 2, y + 7], [x + size - 8, y + 8],
      [x + 8, y + size / 2], [x + size - 8, y + size / 2],
      [x + 8, y + size - 8], [x + size / 2, y + size - 7], [x + size - 8, y + size - 8]
    ];
    for (const [rx, ry] of points) drawIronRivet(ctx, rx, ry, r);

    ctx.restore();
  }

  // --- Action stack (AIM / CAST / MENU / DOWN) ------------------------
  _renderActionStack(r, LAYOUT) {
    const ctx = r.ctx;
    const acts = actionRects(LAYOUT);
    const aimTarget = this._ctx?.aimTarget || null;
    const castReady = !!this._ctx?.castReady;
    const canDescend = !!this._ctx?.canDescend;

    for (const a of acts) {
      const pressed = this._pressedKey === `act:${a.key}`;
      const enabled = (a.key === 'aim') ? !!aimTarget
                    : (a.key === 'cast') ? castReady
                    : (a.key === 'descend') ? canDescend
                    : true;
      const glow = enabled
        ? (a.key === 'aim'  ? `${IRON.ember}99`
         : a.key === 'cast' ? `${IRON.rune}aa`
         : a.key === 'descend' ? `${IRON.brass}66`
         : null)
        : null;
      drawIronPlate(ctx, a.x, a.y, a.w, a.h, { pressed, glow });
      if (!enabled) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#0a0810';
        ctx.fillRect(a.x + 1, a.y + 1, a.w - 2, a.h - 2);
        ctx.restore();
      }
      if (a.variant === 'aim') {
        this._renderAimButton(r, a, pressed, enabled, aimTarget);
      } else if (a.variant === 'cast') {
        this._renderCastButton(r, a, pressed, castReady);
      } else {
        this._renderSideButton(r, a, pressed, enabled);
      }
    }
  }

  _renderAimButton(r, a, pressed, enabled, target) {
    const ctx = r.ctx;
    const cy = a.y + a.h / 2;
    drawReticle(ctx, a.x + 18, cy, 13, enabled);
    const labelCol = enabled ? IRON.bone : IRON.boneDim;
    r.drawText('AIM', a.x + 38, a.y + 8, {
      size: uiSize(11), bold: true, family: FONT_DISPLAY, color: labelCol
    });
    if (target) {
      const sub = `${MobileControls._truncate(target.name, 8)} · ${target.distance}t`;
      r.drawText(sub, a.x + 38, a.y + a.h - 10, {
        size: uiSize(9), family: FONT_MONO, color: IRON.ember
      });
      if (target.dir) {
        r.drawText(dirArrowGlyph(target.dir), a.x + a.w - 14, cy, {
          size: uiSize(12), bold: true, align: 'center', baseline: 'middle',
          color: IRON.brass
        });
      }
    } else {
      r.drawText(enabled ? 'aim ready' : 'no target', a.x + 38, a.y + a.h - 10, {
        size: uiSize(9), italic: true, family: FONT_MONO, color: IRON.boneDim
      });
    }
  }

  _renderCastButton(r, a, pressed, ready) {
    const ctx = r.ctx;
    const cy = a.y + a.h / 2;
    // Rune medallion on left.
    drawBrassJewel(ctx, a.x + 18, cy, 13, {
      pressed,
      variant: ready ? 'rune' : 'brass',
      glyph: '✷'
    });
    const labelCol = ready ? IRON.bone : IRON.boneDim;
    r.drawText('CAST', a.x + 38, a.y + 8, {
      size: uiSize(11), bold: true, family: FONT_DISPLAY, color: labelCol
    });
    r.drawText(ready ? 'tap to cast' : 'no spell', a.x + 38, a.y + a.h - 10, {
      size: uiSize(9), italic: !ready, family: FONT_MONO,
      color: ready ? IRON.rune : IRON.boneDim
    });
  }

  _renderSideButton(r, a, pressed, enabled) {
    const ctx = r.ctx;
    const cy = a.y + a.h / 2;
    const glyph = a.key === 'menu' ? '≡' : '▼';
    const col = enabled ? (a.key === 'descend' ? IRON.brass : IRON.bone) : IRON.boneDim;
    ctx.fillStyle = col;
    ctx.font = `bold ${uiSize(15)}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, a.x + 16, cy);
    r.drawText(a.label, a.x + 32, cy, {
      size: uiSize(11), bold: true, baseline: 'middle',
      family: FONT_DISPLAY, color: col
    });
    if (enabled && a.key === 'descend') {
      // Subtle ember dot indicator.
      drawIronRivet(ctx, a.x + a.w - 8, cy, 2);
    }
  }

  // --- helpers ---------------------------------------------------------
  static _truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  static computeAimTarget(player, floor) {
    if (!player || !floor || typeof floor.enemies !== 'function') return null;
    const range = typeof player.effectiveRange === 'function'
      ? player.effectiveRange()
      : 1;
    if (range <= 1) return null;
    let best = null;
    let bestDist = Infinity;
    for (const e of floor.enemies()) {
      const t = floor.tileAt ? floor.tileAt(e.x, e.y) : null;
      if (t && !t.visible) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > range || dist < bestDist === false) {/* nothing */}
      if (dist <= range && dist < bestDist) {
        bestDist = dist;
        best = {
          x: e.x, y: e.y,
          name: e.name || 'enemy',
          distance: dist,
          dir: deltaToDir(Math.sign(dx), Math.sign(dy))
        };
      }
    }
    return best;
  }

  static get geometry() {
    const LAYOUT = buildLayout();
    return {
      isLandscape: !LAYOUT.portrait,
      band: LAYOUT.band,
      dpadRect: { x: LAYOUT.dpadX, y: LAYOUT.dpadY, w: LAYOUT.dpadSize, h: LAYOUT.dpadSize },
      actionRect: { x: LAYOUT.actX, y: LAYOUT.actY, w: LAYOUT.actW, h: LAYOUT.actStackH },
      centerRect: LAYOUT.centerRect,
      msgRect: null
    };
  }
}

/**
 * CharacterSelect — pick one of the 5 hero variants before a run begins.
 *
 * Carousel layout (matches hero-sprites.jsx mock):
 *   1. Top bar: ◀ back · CHOOSE YOUR VIGIL · "1 / 5" slot indicator
 *   2. Big portrait inside brass-bordered well with corner rivets
 *   3. Hero name (huge spaced serif) + italic subtitle
 *   4. 3 tag chips (iron plate pills)
 *   5. Stats row — ATK / DEF / DEX / TORCH (big numbers + small caps label)
 *   6. PREV  · CHOOSE · NEXT row at the bottom
 *
 * On CHOOSE: persists chosen kind to meta.settings.lastHero and emits
 * `request:newRun` with `{ heroKind }` so Game.newRun forwards it to
 * GameScene → Player.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { HERO_SPELLS } from '../config/heroSpells.js';
import { HERO_ORDER, HERO_DEFS } from '../rendering/heroSprites.js';
import { heroPassiveLabel } from '../gameplay/heroPassives.js';
import {
  drawIronPanel, drawIronPlate, drawIronActionButton,
  drawBrassRivet, drawSpacedText, drawFittedSpacedText, IRON_PALETTE
} from './ironPanel.js';

export class CharacterSelect {
  /** @param {{ bus: object, metaProgress?: object }} deps */
  constructor({ bus, metaProgress }) {
    this.bus = bus;
    this.meta = metaProgress || null;
    this.open = false;
    this.index = 0;
    this._mode = 'normal'; // forwarded to request:newRun
    bus.on('scene:switched', ({ to }) => {
      if (to !== 'title') this.hide();
    });
  }

  /**
   * Show the picker. `mode` is forwarded to the eventual request:newRun so
   * Daily Seed can use the same picker.
   * @param {{ mode?: string }} [opts]
   */
  show(opts = {}) {
    this.open = true;
    this._mode = opts.mode || 'normal';
    this._seed = opts.seed;
    // Default to last-chosen hero (if any).
    const last = this.meta?.state?.settings?.lastHero;
    if (last && HERO_ORDER.includes(last)) {
      this.index = HERO_ORDER.indexOf(last);
    } else {
      this.index = 0;
    }
  }
  hide() { this.open = false; }
  toggle() { this.open ? this.hide() : this.show(); }

  currentKind() { return HERO_ORDER[this.index]; }
  currentDef()  { return HERO_DEFS[this.currentKind()]; }

  // --- input -------------------------------------------------------
  handleInput(action) {
    if (!this.open) return false;
    switch (action.type) {
      case 'move':
        if (action.dx === -1) this._prev();
        else if (action.dx === 1) this._next();
        return true;
      case 'confirm':
      case 'pickup':
        this._choose();
        return true;
      case 'escape':
      case 'inventory':
      case 'vigil':
        this.hide();
        return true;
      default:
        return true;
    }
  }

  handleCanvasTap(canvasX, canvasY) {
    if (!this.open) return false;
    if (this._insideHeaderBack(canvasX, canvasY)) {
      this.hide();
      return true;
    }
    // 1. Bottom action row — PREV / CHOOSE / NEXT.
    const b = this._buttonLayout();
    if (CharacterSelect._inside(canvasX, canvasY, b.prev))   { this._prev();  return true; }
    if (CharacterSelect._inside(canvasX, canvasY, b.choose)) { this._choose(); return true; }
    if (CharacterSelect._inside(canvasX, canvasY, b.next))   { this._next();  return true; }
    // 2. Whole carousel area — left half = prev, right half = next.
    //    Generous hit zones make this work even on very small screens
    //    where the labelled side buttons are hard to hit accurately.
    const buttonRowTop = b.prev.y - 8;
    const headerBottom = 60;
    if (canvasY >= headerBottom && canvasY <= buttonRowTop) {
      const mid = CANVAS_WIDTH / 2;
      if (canvasX < mid) { this._prev(); return true; }
      this._next();
      return true;
    }
    return true;
  }

  _prev()  { this.index = (this.index - 1 + HERO_ORDER.length) % HERO_ORDER.length; }
  _next()  { this.index = (this.index + 1) % HERO_ORDER.length; }
  _choose() {
    const kind = this.currentKind();
    if (this.meta) this.meta.setSetting('lastHero', kind);
    this.hide();
    const payload = { heroKind: kind, mode: this._mode };
    if (this._seed != null) payload.seed = this._seed;
    this.bus.emit('request:newRun', payload);
  }

  static _inside(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  _insideHeaderBack(x, y) { return x >= 6 && x <= 54 && y >= 14 && y <= 58; }

  // --- geometry ----------------------------------------------------
  _portraitRect() {
    const w = IS_LANDSCAPE ? 200 : 240;
    const h = w;
    return {
      x: (CANVAS_WIDTH - w) / 2,
      y: IS_LANDSCAPE ? 78 : 96,
      w, h
    };
  }

  _buttonLayout() {
    const screenH = Layout.canvasH || CANVAS_HEIGHT;
    const baseY = screenH - (IS_LANDSCAPE ? 60 : 76);
    const btnH = IS_LANDSCAPE ? 44 : 56;
    const sideW = 64;
    const gap = 8;
    const mainW = CANVAS_WIDTH - sideW * 2 - gap * 2 - 24;
    return {
      prev:   { x: 12,                          y: baseY, w: sideW, h: btnH },
      choose: { x: 12 + sideW + gap,            y: baseY, w: mainW, h: btnH },
      next:   { x: CANVAS_WIDTH - sideW - 12,   y: baseY, w: sideW, h: btnH }
    };
  }

  // --- render ------------------------------------------------------
  render(renderer) {
    if (!this.open) return;
    const ctx = renderer.ctx;
    const screenH = Layout.canvasH || CANVAS_HEIGHT;
    drawIronPanel(ctx, 0, 0, CANVAS_WIDTH, screenH);

    this._renderHeader(renderer);
    this._renderPortrait(renderer);
    this._renderInfo(renderer);
    this._renderButtons(renderer);
  }

  _renderHeader(r) {
    const ctx = r.ctx;
    drawIronPlate(ctx, 10, 18, 38, 38, { rivets: true });
    r.drawText('◀', 29, 37, {
      size: uiSize(18), align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });

    ctx.save();
    ctx.font = `bold ${uiSize(13)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawFittedSpacedText(ctx, 'CHOOSE YOUR VIGIL', CANVAS_WIDTH / 2, 37,
      CANVAS_WIDTH - 132, 3);
    ctx.restore();

    // Slot indicator (1 / 5) on the right.
    r.drawText(`${this.index + 1} / ${HERO_ORDER.length}`,
      CANVAS_WIDTH - 16, 37, {
        size: uiSize(12), align: 'right', baseline: 'middle',
        family: FONT_MONO, color: IRON_PALETTE.boneDim
      });
  }

  _renderPortrait(r) {
    const ctx = r.ctx;
    const p = this._portraitRect();
    // Recessed well with radial vignette.
    const pg = ctx.createRadialGradient(
      p.x + p.w / 2, p.y + p.h * 0.3, 4,
      p.x + p.w / 2, p.y + p.h / 2, p.w * 0.8);
    pg.addColorStop(0, IRON_PALETTE.plate2);
    pg.addColorStop(1, IRON_PALETTE.ink);
    ctx.fillStyle = pg;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Brass border + outer glow.
    ctx.save();
    ctx.shadowColor = IRON_PALETTE.brass + '55';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = IRON_PALETTE.brass;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    ctx.restore();
    // Hero sprite.
    const sprSize = p.w - 28;
    r.sprites.draw(`hero_${this.currentKind()}`, ctx,
      p.x + (p.w - sprSize) / 2,
      p.y + (p.h - sprSize) / 2,
      { size: sprSize });
    // Corner brass rivets.
    drawBrassRivet(ctx, p.x + 6, p.y + 6, 3);
    drawBrassRivet(ctx, p.x + p.w - 6, p.y + 6, 3);
    drawBrassRivet(ctx, p.x + 6, p.y + p.h - 6, 3);
    drawBrassRivet(ctx, p.x + p.w - 6, p.y + p.h - 6, 3);

    // Carousel arrows (faint hints flanking the portrait).
    ctx.save();
    ctx.font = `${uiSize(32)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.55;
    ctx.fillText('◀', p.x - 22, p.y + p.h / 2);
    ctx.fillText('▶', p.x + p.w + 22, p.y + p.h / 2);
    ctx.restore();
  }

  _renderInfo(r) {
    const ctx = r.ctx;
    const def = this.currentDef();
    const p = this._portraitRect();

    // Hero name — big spaced serif, brass glow.
    const nameY = p.y + p.h + 24;
    ctx.save();
    ctx.font = `bold ${uiSize(20)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.bone;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = IRON_PALETTE.brass + '55';
    ctx.shadowBlur = 12;
    drawFittedSpacedText(ctx, def.name.toUpperCase(), CANVAS_WIDTH / 2, nameY,
      CANVAS_WIDTH - 48, 1.4);
    ctx.restore();

    // Italic subtitle.
    r.drawText(def.subtitle,
      CANVAS_WIDTH / 2, nameY + 22, {
        size: uiSize(11), italic: true, align: 'center',
        family: FONT_BODY, color: IRON_PALETTE.boneDim
      });

    const roleY = nameY + 40;
    drawIronPlate(ctx, CANVAS_WIDTH / 2 - 42, roleY, 84, 18, { rivets: false });
    ctx.save();
    ctx.font = `bold ${uiSize(9)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawSpacedText(ctx, (def.role || 'WANDERER').toUpperCase(),
      CANVAS_WIDTH / 2, roleY + 9, 1.5);
    ctx.restore();

    // 3 tag chips.
    const tagsY = nameY + 64;
    ctx.font = `bold ${uiSize(9)}px ${FONT_DISPLAY}`;
    const chipW = [];
    let total = 0;
    for (const tag of def.tags) {
      const w = ctx.measureText(tag.toUpperCase()).width + 14;
      chipW.push(w);
      total += w;
    }
    total += (def.tags.length - 1) * 6;
    let cx = (CANVAS_WIDTH - total) / 2;
    for (let i = 0; i < def.tags.length; i++) {
      drawIronPlate(ctx, cx, tagsY, chipW[i], 20, { rivets: false });
      ctx.save();
      ctx.font = `bold ${uiSize(9)}px ${FONT_DISPLAY}`;
      ctx.fillStyle = IRON_PALETTE.brass;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawSpacedText(ctx, def.tags[i].toUpperCase(),
        cx + chipW[i] / 2, tagsY + 10, 1.5);
      ctx.restore();
      cx += chipW[i] + 6;
    }

    const spellY = tagsY + 32;
    this._renderSpellCard(r, def, spellY);

    const passiveY = spellY + 46;
    r.drawText(heroPassiveLabel(def.kind), CANVAS_WIDTH / 2, passiveY, {
      size: uiSize(9), italic: true, align: 'center',
      family: FONT_BODY, color: IRON_PALETTE.boneDim
    });

    // Stat strip — HP / ATK / DEF / DEX / TORCH.
    const statsY = spellY + 62;
    const cells = [
      ['HP',    def.stats.hp ?? 30],
      ['ATK',   def.stats.atk],
      ['DEF',   def.stats.def],
      ['DEX',   def.stats.dex],
      ['TORCH', def.stats.torchRadius]
    ];
    const cellW = (CANVAS_WIDTH - 32) / cells.length;
    for (let i = 0; i < cells.length; i++) {
      const cx2 = 16 + i * cellW;
      r.drawText(String(cells[i][1]), cx2 + cellW / 2, statsY + 8, {
        size: uiSize(22), bold: true, align: 'center', baseline: 'middle',
        family: FONT_MONO, color: IRON_PALETTE.bone
      });
      ctx.save();
      ctx.font = `${uiSize(9)}px ${FONT_DISPLAY}`;
      ctx.fillStyle = IRON_PALETTE.boneDim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawSpacedText(ctx, cells[i][0],
        cx2 + cellW / 2, statsY + 30, 2);
      ctx.restore();
      // hairline divider between cells.
      if (i > 0) {
        ctx.fillStyle = IRON_PALETTE.plate2;
        ctx.fillRect(cx2, statsY - 2, 1, 44);
      }
    }
  }

  _renderSpellCard(r, def, y) {
    const ctx = r.ctx;
    const spell = HERO_SPELLS[def.kind];
    if (!spell) return;
    const x = 54;
    const w = CANVAS_WIDTH - 108;
    const h = 42;
    drawIronPlate(ctx, x, y, w, h, { rivets: false, glow: spell.color });
    ctx.save();
    ctx.font = `bold ${uiSize(9)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = spell.color || IRON_PALETTE.brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    drawSpacedText(ctx, 'MAGIC', x + 36, y + 7, 1.5);
    ctx.restore();
    r.drawText(spell.name.toUpperCase(), x + 76, y + 6, {
      size: uiSize(11), bold: true, family: FONT_DISPLAY,
      color: IRON_PALETTE.bone
    });
    const meta = `CD ${spell.cooldown}${spell.range ? `  RNG ${spell.range}` : ''}${spell.radius ? `  AREA ${spell.radius}` : ''}`;
    r.drawText(meta, x + w - 10, y + 7, {
      size: uiSize(8), bold: true, align: 'right',
      family: FONT_MONO, color: IRON_PALETTE.boneDim
    });
    drawFittedPlainText(ctx, spell.description, x + 76, y + 25, w - 88,
      uiSize(9), FONT_BODY, IRON_PALETTE.boneDim);
  }

  _renderButtons(r) {
    const b = this._buttonLayout();
    drawIronActionButton(r, b.prev.x, b.prev.y, b.prev.w, b.prev.h, '◀', {
      accent: IRON_PALETTE.brass, fontSize: 18, rivets: false
    });
    drawIronActionButton(r, b.choose.x, b.choose.y, b.choose.w, b.choose.h, 'CHOOSE', {
      accent: IRON_PALETTE.brass, fontSize: 14
    });
    drawIronActionButton(r, b.next.x, b.next.y, b.next.w, b.next.h, '▶', {
      accent: IRON_PALETTE.brass, fontSize: 18, rivets: false
    });
  }
}

function drawFittedPlainText(ctx, text, x, y, maxW, preferredSize, family, color) {
  let size = preferredSize;
  ctx.font = `italic ${size}px ${family}`;
  while (size > 9 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = `italic ${size}px ${family}`;
  }
  ctx.save();
  ctx.font = `italic ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * VigilScreen — character sheet rendered in the wrought-iron vocabulary.
 *
 * Match for iron-screens.jsx photo 2:
 *   1. Top bar: ◀ back   THE VIGIL   RUN
 *   2. Italic "THE LAST VIGIL" + huge spaced name "FAJAR"
 *   3. LV chip + EXPERIENCE label + XP bar
 *   4. Portrait inside brass-bordered well with corner rivets
 *   5. HP bar (thick, blood red)
 *   6. Stats table — 6 rows, key on left + value on right, hairlines
 *   7. Equipment list — one row per slot, brass UNEQUIP chip if filled
 *   8. CLOSE button anchored at the bottom
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_MONO, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import {
  drawIronPanel, drawIronPlate, drawBrassRivet,
  drawInsetCard, drawProgressBar, drawIronActionButton,
  drawEquipRow, drawSpacedText, IRON_PALETTE, rarityColor
} from './ironPanel.js';

const HERO_NAME = 'FAJAR';
const HERO_TITLE = 'THE LAST VIGIL';

export class VigilScreen {
  /** @param {{ bus: object }} deps */
  constructor({ bus }) {
    this.bus = bus;
    this.open = false;
    this._pickerSlot = null;
    this._pickerHits = [];
    bus.on('request:newRun', () => this.hide());
    bus.on('scene:switched', ({ to }) => {
      if (to !== 'game') this.hide();
    });
  }

  show() { this.open = true; }
  hide() { this.open = false; this._pickerSlot = null; this._pickerHits = []; }
  toggle() { this.open = !this.open; }

  handleInput(player, input) {
    if (!this.open) return false;
    if (input.type === 'vigil' || input.type === 'inventory' || input.type === 'escape') {
      this.hide();
      return true;
    }
    return true;
  }

  handleCanvasTap(canvasX, canvasY, player) {
    if (!this.open) return false;
    if (this._insideHeaderBack(canvasX, canvasY)) {
      this.hide();
      return true;
    }
    if (this._pickerSlot) {
      for (const hit of this._pickerHits) {
        if (canvasX >= hit.x && canvasX <= hit.x + hit.w &&
            canvasY >= hit.y && canvasY <= hit.y + hit.h) {
          if (hit.kind === 'cancel') {
            this._pickerSlot = null;
            this._pickerHits = [];
          } else if (hit.kind === 'equip') {
            this.bus.emit('command:equipSlot', { index: hit.index });
            this._pickerSlot = null;
            this._pickerHits = [];
          }
          return true;
        }
      }
      this._pickerSlot = null;
      this._pickerHits = [];
      return true;
    }
    const cards = this._equipmentCards(player);
    for (const c of cards) {
      const btn = c.unequipBtn;
      if (c.item && canvasX >= btn.x && canvasX <= btn.x + btn.w &&
          canvasY >= btn.y && canvasY <= btn.y + btn.h) {
        this.bus.emit('command:unequip', { slot: c.slot });
        return true;
      }
      if (canvasX >= c.x && canvasX <= c.x + c.w &&
          canvasY >= c.y && canvasY <= c.y + c.h) {
        this._openEquipPicker(c.slot, player);
        return true;
      }
    }
    const close = this._closeRect();
    if (canvasX >= close.x && canvasX <= close.x + close.w &&
        canvasY >= close.y && canvasY <= close.y + close.h) {
      this.hide();
      return true;
    }
    return true;
  }

  _openEquipPicker(slot, player) {
    this._pickerSlot = slot;
    this._pickerHits = [];
  }

  _equippableInBag(player, slot) {
    const inv = player.inventory;
    const out = [];
    if (!inv?.getSlot) return out;
    for (let i = 0; i < inv.size; i++) {
      const item = inv.getSlot(i);
      if (item?.slot === slot) out.push({ index: i, item });
    }
    return out;
  }

  // --- geometry -----------------------------------------------------
  _closeRect() {
    const w = IS_LANDSCAPE ? 200 : 240;
    const h = IS_LANDSCAPE ? 40  : 50;
    const screenH = Layout.canvasH || CANVAS_HEIGHT;
    return { x: (CANVAS_WIDTH - w) / 2, y: screenH - h - 16, w, h };
  }

  _insideHeaderBack(x, y) {
    return x >= 6 && x <= 54 && y >= 14 && y <= 58;
  }

  _equipmentCards(player) {
    const slots = [
      { slot: 'weapon',   item: player.weapon },
      { slot: 'helm',     item: player.helm },
      { slot: 'armor',    item: player.armor },
      { slot: 'legs',     item: player.legs },
      { slot: 'necklace', item: player.necklace },
      { slot: 'ring',     item: player.ring }
    ];
    const cardH = IS_LANDSCAPE ? 50 : 48;
    const cardGap = IS_LANDSCAPE ? 6 : 5;
    const cardW = CANVAS_WIDTH - 32;
    const cardX = 16;
    const cardsBaseY = this._cardsBaseY();
    for (let i = 0; i < slots.length; i++) {
      const y = cardsBaseY + i * (cardH + cardGap);
      const btnW = 76, btnH = 26;
      slots[i].x = cardX;
      slots[i].y = y;
      slots[i].w = cardW;
      slots[i].h = cardH;
      slots[i].unequipBtn = {
        x: cardX + cardW - btnW - 8,
        y: y + (cardH - btnH) / 2,
        w: btnW, h: btnH
      };
    }
    return slots;
  }

  _cardsBaseY() {
    return IS_LANDSCAPE ? 210 : 512;
  }

  // --- render -------------------------------------------------------
  render(renderer, player) {
    if (!this.open) return;
    const screenH = Layout.canvasH || CANVAS_HEIGHT;
    // Full-bleed iron panel chrome.
    drawIronPanel(renderer.ctx, 0, 0, CANVAS_WIDTH, screenH);

    if (IS_LANDSCAPE) this._renderLandscape(renderer, player);
    else              this._renderPortrait(renderer, player);

    // CLOSE button.
    const close = this._closeRect();
    drawIronActionButton(renderer, close.x, close.y, close.w, close.h, 'CLOSE',
      { accent: IRON_PALETTE.brass, fontSize: 14 });
  }

  // ---- portrait layout ---------------------------------------------
  _renderPortrait(r, p) {
    const ctx = r.ctx;

    // 1. Top bar: back plate left + title middle + RUN plate right.
    drawIronPlate(ctx, 10, 18, 38, 38, { rivets: true });
    r.drawText('◀', 29, 37, {
      size: uiSize(18), align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });
    ctx.save();
    ctx.font = `bold ${uiSize(13)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawSpacedText(ctx, 'THE VIGIL', 112, 37, 3);
    ctx.restore();
    drawIronPlate(ctx, CANVAS_WIDTH - 70, 22, 60, 30, { rivets: false });
    ctx.save();
    ctx.font = `bold ${uiSize(11)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.blood;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawSpacedText(ctx, 'RUN', CANVAS_WIDTH - 40, 37, 3);
    ctx.restore();

    // 2. Subtitle (italic) + huge name.
    r.drawText(HERO_TITLE, CANVAS_WIDTH / 2, 78, {
      size: uiSize(12), italic: true, align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: IRON_PALETTE.boneDim
    });
    ctx.save();
    ctx.font = `bold ${uiSize(34)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.bone;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = IRON_PALETTE.brass + '55';
    ctx.shadowBlur = 16;
    drawSpacedText(ctx, HERO_NAME, CANVAS_WIDTH / 2, 110, 8);
    ctx.restore();

    // 3. LV chip + XP bar.
    const lvY = 142;
    const xpVal = p.xp || 0;
    const xpMax = p.xpToNext();
    drawIronPlate(ctx, 16, lvY, 70, 28, { rivets: false, glow: IRON_PALETTE.brass });
    ctx.save();
    ctx.font = `bold ${uiSize(13)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawSpacedText(ctx, `LV ${p.level}`, 51, lvY + 14, 2);
    ctx.restore();

    r.drawText('EXPERIENCE', 96, lvY + 4, {
      size: uiSize(9), family: FONT_MONO, color: IRON_PALETTE.boneDim
    });
    const xpLabel = Number.isFinite(xpMax) ? `XP ${xpVal} / ${xpMax}` : `XP ${xpVal}`;
    r.drawText(xpLabel, CANVAS_WIDTH - 16, lvY + 4, {
      size: uiSize(9), align: 'right', family: FONT_MONO, color: IRON_PALETTE.boneDim
    });
    drawProgressBar(ctx, 96, lvY + 18,
      CANVAS_WIDTH - 16 - 96, 6,
      xpVal, Number.isFinite(xpMax) ? xpMax : Math.max(1, xpVal),
      IRON_PALETTE.brass);

    // 4. Portrait well (brass-bordered, corner rivets).
    const portraitSize = 112;
    const px = (CANVAS_WIDTH - portraitSize) / 2;
    const py = 184;
    const pg = ctx.createRadialGradient(
      px + portraitSize / 2, py + portraitSize * 0.3, 4,
      px + portraitSize / 2, py + portraitSize / 2, portraitSize * 0.8);
    pg.addColorStop(0, IRON_PALETTE.plate2);
    pg.addColorStop(1, IRON_PALETTE.ink);
    ctx.fillStyle = pg;
    ctx.fillRect(px, py, portraitSize, portraitSize);
    // Inner glow.
    ctx.save();
    ctx.shadowColor = IRON_PALETTE.brass + '55';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = IRON_PALETTE.brass;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, portraitSize - 2, portraitSize - 2);
    ctx.restore();
    // Hero portrait sprite.
    const sprSize = portraitSize - 24;
    r.sprites.draw(`portrait_${p.heroKind || 'vigil'}`, r.ctx,
      px + (portraitSize - sprSize) / 2,
      py + (portraitSize - sprSize) / 2,
      { size: sprSize });
    // Corner rivets.
    drawBrassRivet(ctx, px + 6, py + 6, 3);
    drawBrassRivet(ctx, px + portraitSize - 6, py + 6, 3);
    drawBrassRivet(ctx, px + 6, py + portraitSize - 6, 3);
    drawBrassRivet(ctx, px + portraitSize - 6, py + portraitSize - 6, 3);

    // 5. HP bar.
    const hpY = py + portraitSize + 20;
    ctx.save();
    ctx.font = `bold ${uiSize(13)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.bone;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    drawSpacedText(ctx, 'HP', 18 + ctx.measureText('HP').width / 2, hpY, 2);
    ctx.restore();
    r.drawText(`${p.stats.hp} / ${p.stats.hpMax}`, CANVAS_WIDTH - 16, hpY, {
      size: uiSize(13), bold: true, align: 'right', family: FONT_MONO, color: IRON_PALETTE.bone
    });
    drawProgressBar(ctx, 16, hpY + 18, CANVAS_WIDTH - 32, 10,
      p.stats.hp, p.stats.hpMax, IRON_PALETTE.blood);

    // 6. Stats table (recessed card).
    this._renderStatTable(r, p, hpY + 38);

    // 7. Equipment header + rows.
    const cards = this._equipmentCards(p);
    const equipHeaderY = this._cardsBaseY() - 20;
    ctx.save();
    ctx.font = `${uiSize(10)}px ${FONT_MONO}`;
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    drawSpacedText(ctx, 'EQUIPMENT', 64, equipHeaderY, 2);
    ctx.restore();
    const filledCount = cards.filter((c) => c.item).length;
    r.drawText(`${filledCount} / ${cards.length} equipped`,
      CANVAS_WIDTH - 16, equipHeaderY, {
        size: uiSize(9), align: 'right', family: FONT_MONO, color: IRON_PALETTE.boneDim
      });
    for (const c of cards) {
      drawEquipRow(r, c.x, c.y, c.w, c.h, c.slot, c.item);
    }
    if (this._pickerSlot) this._renderEquipPicker(r, p);
  }

  _renderStatTable(r, p, baseY) {
    const ctx = r.ctx;
    const tableX = 16, tableW = CANVAS_WIDTH - 32;
    const rows = [
      ['ATTACK',      String(p.totalAtk ? p.totalAtk() : (p.stats.atk + (p.weapon?.stats?.atk || 0)))],
      ['DEFENSE',     String(p.totalDef ? p.totalDef() : (p.stats.def + (p.armor?.stats?.def || 0)))],
      ['DEXTERITY',   String(p.stats.dex || 0)],
      ['CRIT CHANCE', `${Math.round((p.critChance ? p.critChance() : 0.05) * 100)}%`],
      ['LIFESTEAL',   `${Math.round((p.lifesteal || 0) * 100)}%`],
      ['TORCH',       `${p.torchRadius || 5} TILES`]
    ];
    const rowH = IS_LANDSCAPE ? 22 : 18;
    const tableH = rowH * rows.length + 10;
    drawInsetCard(ctx, tableX, baseY, tableW, tableH);

    for (let i = 0; i < rows.length; i++) {
      const y = baseY + 5 + i * rowH;
      // hairline divider
      if (i < rows.length - 1) {
        ctx.fillStyle = IRON_PALETTE.plate2;
        ctx.fillRect(tableX + 12, y + rowH - 1, tableW - 24, 1);
      }
      // key (left)
      ctx.save();
      ctx.font = `${uiSize(IS_LANDSCAPE ? 11 : 9)}px ${FONT_DISPLAY}`;
      ctx.fillStyle = IRON_PALETTE.boneDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawSpacedText(ctx, rows[i][0],
        tableX + 14 + ctx.measureText(rows[i][0]).width / 2,
        y + rowH / 2, 2);
      ctx.restore();
      // value (right, mono bold)
      r.drawText(rows[i][1], tableX + tableW - 14, y + rowH / 2, {
        size: uiSize(IS_LANDSCAPE ? 12 : 10), bold: true, align: 'right', baseline: 'middle',
        family: FONT_MONO, color: IRON_PALETTE.bone
      });
    }
  }

  // ---- landscape layout --------------------------------------------
  _renderLandscape(r, p) {
    // Match portrait visual vocabulary but in two columns (portrait left,
    // stats + equipment right). Reuses the same primitives.
    const ctx = r.ctx;
    // Top bar (slim).
    drawIronPlate(ctx, 8, 12, 30, 30, { rivets: true });
    r.drawText('◀', 23, 27, {
      size: uiSize(15), align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });
    ctx.save();
    ctx.font = `bold ${uiSize(13)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.brass;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawSpacedText(ctx, 'THE VIGIL', 92, 27, 3);
    ctx.restore();
    r.drawText(HERO_NAME, CANVAS_WIDTH / 2, 60, {
      size: uiSize(20), bold: true, align: 'center',
      family: FONT_DISPLAY, color: IRON_PALETTE.bone
    });
    // Portrait box left.
    const ps = 96, px = 16, py = 80;
    ctx.fillStyle = IRON_PALETTE.ink;
    ctx.fillRect(px, py, ps, ps);
    ctx.strokeStyle = IRON_PALETTE.brass;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, ps - 2, ps - 2);
    r.sprites.draw(`portrait_${p.heroKind || 'vigil'}`, r.ctx, px + 8, py + 8, { size: ps - 16 });
    drawBrassRivet(ctx, px + 5, py + 5, 2.5);
    drawBrassRivet(ctx, px + ps - 5, py + 5, 2.5);
    drawBrassRivet(ctx, px + 5, py + ps - 5, 2.5);
    drawBrassRivet(ctx, px + ps - 5, py + ps - 5, 2.5);
    // HP next to portrait.
    const hpX = px + ps + 16;
    const hpY = py + 12;
    r.drawText(`HP  ${p.stats.hp} / ${p.stats.hpMax}`, hpX, hpY, {
      size: uiSize(11), bold: true, family: FONT_DISPLAY, color: IRON_PALETTE.bone
    });
    drawProgressBar(ctx, hpX, hpY + 16, CANVAS_WIDTH - hpX - 16, 8,
      p.stats.hp, p.stats.hpMax, IRON_PALETTE.blood);
    // Stats inside the gap.
    this._renderStatTable(r, p, py + ps + 16);
    // Equipment list.
    const cards = this._equipmentCards(p);
    for (const c of cards) drawEquipRow(r, c.x, c.y, c.w, c.h, c.slot, c.item);
    if (this._pickerSlot) this._renderEquipPicker(r, p);
  }

  _renderEquipPicker(r, player) {
    const slot = this._pickerSlot;
    const items = this._equippableInBag(player, slot);
    const close = this._closeRect();
    const panelY = this._cardsBaseY() - 8;
    const panelH = close.y - panelY - 12;
    const panelX = 12;
    const panelW = CANVAS_WIDTH - 24;
    const ctx = r.ctx;

    ctx.fillStyle = 'rgba(4,2,8,0.88)';
    ctx.fillRect(0, panelY - 4, CANVAS_WIDTH, panelH + 8);

    drawInsetCard(ctx, panelX, panelY, panelW, panelH, { borderColor: IRON_PALETTE.brass });
    const title = `CHOOSE ${slot.toUpperCase()}`;
    r.drawText(title, CANVAS_WIDTH / 2, panelY + 14, {
      size: uiSize(12), bold: true, align: 'center', family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });

    const rowH = IS_LANDSCAPE ? 44 : 40;
    const listY = panelY + 28;
    const listH = panelH - 72;
    const maxRows = Math.max(1, Math.floor(listH / rowH));
    const slice = items.slice(0, maxRows);
    this._pickerHits = [];

    for (let i = 0; i < slice.length; i++) {
      const { index, item } = slice[i];
      const ry = listY + i * rowH;
      const col = rarityColor(item.rarity);
      r.drawRect(panelX + 10, ry, panelW - 20, rowH - 4, IRON_PALETTE.plate0);
      r.drawStrokedRect(panelX + 10, ry, panelW - 20, rowH - 4, col, 1);
      const icon = rowH - 14;
      const ix = panelX + 16;
      const iy = ry + 5;
      r.drawRect(ix, iy, icon, icon, IRON_PALETTE.ink);
      if (item.spriteKey && r.sprites) {
        r.sprites.draw(item.spriteKey, ctx, ix + 2, iy + 2, { size: icon - 4 });
      }
      const tx = ix + icon + 10;
      r.drawText(item.name, tx, ry + 10, {
        size: uiSize(12), bold: true, family: FONT_DISPLAY, color: col
      });
      const stat = VigilScreen._itemStatLine(item);
      if (stat) {
        r.drawText(stat, tx, ry + 24, {
          size: uiSize(9), family: FONT_MONO, color: IRON_PALETTE.boneDim
        });
      }
      this._pickerHits.push({
        kind: 'equip', index,
        x: panelX + 10, y: ry, w: panelW - 20, h: rowH - 4
      });
    }

    if (items.length === 0) {
      r.drawText('No matching items in bag', CANVAS_WIDTH / 2, listY + 20, {
        size: uiSize(11), align: 'center', italic: true,
        family: FONT_BODY, color: IRON_PALETTE.boneDim
      });
    } else if (items.length > maxRows) {
      r.drawText(`+${items.length - maxRows} more in bag — use BAG to swap`,
        CANVAS_WIDTH / 2, listY + maxRows * rowH + 4, {
          size: uiSize(8), align: 'center', family: FONT_MONO, color: IRON_PALETTE.boneDim
        });
    }

    const cancelY = panelY + panelH - 34;
    const cancelW = 120;
    const cancelX = (CANVAS_WIDTH - cancelW) / 2;
    drawIronActionButton(r, cancelX, cancelY, cancelW, 28, 'CANCEL',
      { accent: IRON_PALETTE.boneDim, fontSize: 11 });
    this._pickerHits.push({ kind: 'cancel', x: cancelX, y: cancelY, w: cancelW, h: 28 });
  }

  static _itemStatLine(item) {
    if (!item.stats) return '';
    const parts = [];
    for (const [k, v] of Object.entries(item.stats)) {
      if (!v) continue;
      parts.push(`${v > 0 ? '+' : ''}${v} ${k.toUpperCase()}`);
    }
    return parts.slice(0, 3).join('  ');
  }
}

/**
 * Crafting modal.
 *
 * Renders a scrollable list of recipes with: name, description, inputs
 * (with have/need counts), and a CRAFT button per recipe. Disabled rows
 * grey out when materials are insufficient.
 *
 * Open / close handled by the parent (PauseOverlay or a future Workshop
 * scene). Tap a CRAFT row → emits 'craft:request' with the recipe id.
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize } from '../config/constants.js';
import { listRecipes, canCraft } from '../items/Crafting.js';
import { IRON } from './ironHud.js';

const BRASS = '#d4ac6c';
const BRASS_HI = '#f1d49a';
const BRASS_DARK = '#7a5c2c';

export class CraftingPanel {
  constructor({ bus, player, materialDefs }) {
    this.bus = bus;
    this.player = player;
    this.materialDefs = materialDefs || {};
    this.open = false;
    this._scroll = 0;
    this._rowRects = [];   // hit-test cache for CRAFT buttons
    this._targetRects = [];
    this._rerollTarget = 0;
    this.offerRecipeIds = null;
  }

  show(offerRecipeIds = null)  {
    this.open = true;
    this._scroll = 0;
    this.offerRecipeIds = Array.isArray(offerRecipeIds) ? offerRecipeIds : null;
  }
  hide()  { this.open = false; }

  render(r) {
    if (!this.open) return;
    const ctx = r.ctx;
    const allRecipes = listRecipes();
    const recipes = this.offerRecipeIds
      ? this.offerRecipeIds.map((id) => allRecipes.find((r) => r.id === id)).filter(Boolean)
      : allRecipes;
    const padX = 16;
    const modalY = 60;
    const modalH = CANVAS_HEIGHT - 120;
    const modalX = padX;
    const modalW = CANVAS_WIDTH - padX * 2;

    // Background plate
    ctx.save();
    const g = ctx.createLinearGradient(0, modalY, 0, modalY + modalH);
    g.addColorStop(0, IRON.plate1);
    g.addColorStop(1, IRON.plate0);
    ctx.fillStyle = g;
    ctx.fillRect(modalX, modalY, modalW, modalH);
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX + 0.5, modalY + 0.5, modalW - 1, modalH - 1);
    ctx.restore();

    // Header
    r.drawText('THE VEILED SMITH', CANVAS_WIDTH / 2, modalY + 18, {
      size: uiSize(18), bold: true, align: 'center',
      family: FONT_DISPLAY, color: BRASS_HI
    });
    r.drawText('three offers, one visit, no second bargain', CANVAS_WIDTH / 2, modalY + 40, {
      size: uiSize(10), italic: true, align: 'center',
      family: FONT_BODY, color: COLOR.textMuted
    });

    const rerollTargets = eligibleRerollTargets(this.player);
    this._targetRects = [];
    let listY = modalY + 56;
    if (recipes.some((r) => r.operation === 'reroll')) {
      const target = rerollTargets[this._rerollTarget % Math.max(1, rerollTargets.length)];
      const ty = modalY + 52;
      r.drawRect(modalX + 8, ty, modalW - 16, 30, '#120e18');
      r.drawStrokedRect(modalX + 8, ty, modalW - 16, 30, BRASS_DARK, 1);
      r.drawText('REROLL TARGET', modalX + 18, ty + 9, {
        size: uiSize(8), bold: true, family: FONT_MONO, color: BRASS
      });
      r.drawText(target ? target.item.name : 'no equipment in bag or worn', modalX + 18, ty + 22, {
        size: uiSize(10), family: FONT_BODY, color: target ? COLOR.textPrimary : COLOR.textMuted
      });
      const bx = modalX + modalW - 88;
      r.drawRect(bx, ty + 4, 66, 22, target ? IRON.plate2 : '#16101a');
      r.drawStrokedRect(bx, ty + 4, 66, 22, target ? BRASS : IRON.ink, 1);
      r.drawText('CHANGE', bx + 33, ty + 15, {
        size: uiSize(8), bold: true, align: 'center', baseline: 'middle',
        family: FONT_MONO, color: target ? BRASS_HI : IRON.boneDim
      });
      this._targetRects.push({ x: bx, y: ty + 4, w: 66, h: 22, enabled: rerollTargets.length > 1 });
      listY = modalY + 88;
    }
    const pouchLine = this._pouchLine();
    if (pouchLine) {
      r.drawText(pouchLine, CANVAS_WIDTH / 2, listY - 6, {
        size: uiSize(8), align: 'center', family: FONT_MONO, color: COLOR.textMuted
      });
    }

    // Recipe rows
    const rowH = 70;
    const listX = modalX + 8;
    const listW = modalW - 16;
    const listH = modalY + modalH - 56 - listY;   // leave room for close button
    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    this._rowRects = [];
    let y = listY + 4 - this._scroll;
    for (const recipe of recipes) {
      const check = canCraft(this.player, recipe);
      const needsTarget = recipe.operation === 'reroll';
      const enabled = check.ok && (!needsTarget || rerollTargets.length > 0);
      this._rowRects.push({ id: recipe.id, x: listX, y, w: listW, h: rowH, enabled });
      if (y + rowH < listY || y > listY + listH) {
        y += rowH + 4;
        continue;
      }
      this._drawRecipeRow(r, recipe, listX, y, listW, rowH, enabled, check, needsTarget && rerollTargets.length === 0);
      y += rowH + 4;
    }
    ctx.restore();

    // Close button
    const closeY = modalY + modalH - 48;
    const closeX = CANVAS_WIDTH / 2 - 80;
    r.drawRect(closeX, closeY, 160, 36, IRON.plate0);
    r.drawStrokedRect(closeX, closeY, 160, 36, BRASS, 2);
    r.drawText('CLOSE', CANVAS_WIDTH / 2, closeY + 18, {
      size: uiSize(13), bold: true, align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: BRASS_HI
    });
    this._closeRect = { x: closeX, y: closeY, w: 160, h: 36 };
  }

  _drawRecipeRow(r, recipe, x, y, w, h, enabled, check, missingTarget = false) {
    const ctx = r.ctx;
    ctx.save();
    ctx.fillStyle = enabled ? IRON.plate2 : '#0c0a14';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = enabled ? BRASS_DARK : IRON.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();

    r.drawText(recipe.name, x + 8, y + 6, {
      size: uiSize(13), bold: true, family: FONT_DISPLAY,
      color: enabled ? BRASS_HI : IRON.boneDim
    });
    r.drawText(recipe.description, x + 8, y + 24, {
      size: uiSize(10), italic: true, family: FONT_BODY,
      color: COLOR.textMuted
    });
    // Inputs line: "3× Scrap Iron · 1× Ember Dust (have 1)"
    const parts = (recipe.inputs || []).map((inp) => {
      const m = this.materialDefs[inp.materialId];
      const name = m?.name || inp.materialId;
      const miss = check.missing?.find((x) => x.id === inp.materialId);
      const have = miss ? miss.have : inp.count;
      const tag = miss ? ` (have ${have})` : '';
      return `${inp.count}× ${name}${tag}`;
    });
    const inputLine = missingTarget ? `${parts.join('  ·  ')}  ·  needs equipment target` : parts.join('  ·  ');
    r.drawText(inputLine, x + 8, y + h - 14, {
      size: uiSize(10), family: FONT_MONO,
      color: enabled ? COLOR.textPrimary : '#7a5a44'
    });

    // CRAFT chip on the right
    const cw = 64, ch = 26;
    const cx = x + w - cw - 8;
    const cy = y + (h - ch) / 2;
    r.drawRect(cx, cy, cw, ch, enabled ? '#2e3a2a' : '#241c20');
    r.drawStrokedRect(cx, cy, cw, ch, enabled ? '#80c060' : IRON.ink, enabled ? 2 : 1);
    r.drawText(enabled ? (recipe.operation === 'reroll' ? 'REROLL' : 'CRAFT') : '—', cx + cw / 2, cy + ch / 2, {
      size: uiSize(11), bold: true, align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: enabled ? '#a8ff90' : IRON.boneDim
    });
  }

  /** Handle a tap. Returns true if the panel consumed the input. */
  handleTap(x, y) {
    if (!this.open) return false;
    if (this._closeRect && _inside(x, y, this._closeRect)) {
      this.hide();
      return true;
    }
    const targets = eligibleRerollTargets(this.player);
    for (const rect of this._targetRects) {
      if (rect.enabled && _inside(x, y, rect)) {
        this._rerollTarget = (this._rerollTarget + 1) % targets.length;
        return true;
      }
    }
    const cw = 64, ch = 26;
    for (const rect of this._rowRects) {
      const bx = rect.x + rect.w - cw - 8;
      const by = rect.y + (rect.h - ch) / 2;
      if (rect.enabled && _insideAt(x, y, bx, by, cw, ch)) {
      const recipe = listRecipes().find((r) => r.id === rect.id);
        const target = recipe?.operation === 'reroll'
          ? targets[this._rerollTarget % Math.max(1, targets.length)]
          : null;
        this.bus?.emit('craft:request', { recipeId: rect.id, target });
        return true;
      }
    }
    return false;
  }

  _pouchLine() {
    const mats = this.player?.materials || {};
    const parts = Object.entries(mats)
      .filter(([, count]) => count > 0)
      .slice(0, 4)
      .map(([id, count]) => `${this.materialDefs[id]?.name || id} x${count}`);
    if (parts.length === 0) return 'Material pouch empty';
    const more = Object.keys(mats).length > parts.length ? ' ...' : '';
    return `Pouch: ${parts.join(' · ')}${more}`;
  }
}

function eligibleRerollTargets(player) {
  if (!player) return [];
  const out = [];
  const slots = ['weapon', 'armor', 'helm', 'legs', 'necklace', 'ring'];
  for (const slot of slots) {
    const item = player[slot];
    if (item?.slot) out.push({ kind: 'equipment', slot, item });
  }
  const inv = player.inventory?.slots || [];
  for (let i = 0; i < inv.length; i++) {
    const item = inv[i];
    if (item?.slot) out.push({ kind: 'inventory', index: i, item });
  }
  return out;
}

function _inside(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
function _insideAt(x, y, bx, by, bw, bh) {
  return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
}

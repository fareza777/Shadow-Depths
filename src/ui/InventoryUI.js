/**
 * InventoryUI — mock-matched satchel screen.
 *
 * Layout:
 *   1. Header: "SATCHEL" + count "X / Y" + coin balance
 *   2. Tab strip: ALL · ARMS · GARB · PHIAL · THROWN · CHARMS · POUCH
 *   3. Slot grid (filtered by active tab)
 *   4. Selected item detail card (name + rarity chip + stats + lore + action button)
 *
 * The grid shows only slots matching the active tab. Tabs are taps, no
 * keyboard binding (mobile-first). Detail card replaces the old tooltip
 * line — bigger, easier to read on phones.
 */
import {
  CANVAS_HEIGHT,
  FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import {
  drawIronPanel, drawIronPlate, drawIronSlot, drawInsetCard,
  drawIronActionButton, drawSpacedText, IRON_PALETTE,
  rarityColor as ironRarity
} from './ironPanel.js';
import { Tooltip } from './Tooltip.js';

const TABS = [
  { id: 'all',     label: 'ALL'    },
  { id: 'arms',    label: 'ARMS'   },
  { id: 'garb',    label: 'GARB'   },
  { id: 'phial',   label: 'PHIAL'  },
  { id: 'thrown',  label: 'THROW'  },
  { id: 'charms',  label: 'CHARM'  },
  { id: 'mats',    label: 'MATS'   }
];

/** Runtime canvas width — frozen CANVAS_WIDTH disagrees with Layout on phones. */
function screenW() { return Layout.canvasW; }
function screenH() { return Layout.canvasH || CANVAS_HEIGHT; }
function portrait() { return Layout.portrait; }

function slotSize()    { return portrait() ? 80 : 56; }
function slotPadding() { return portrait() ? 8 : 6; }
function gridCols()    { return portrait() ? 3 : 4; }
function gridTop()     { return portrait() ? 116 : 92; }
function tabH()        { return portrait() ? 32 : 28; }
function tabY()        { return portrait() ? 78 : 56; }
function detailH()     { return portrait() ? 140 : 110; }
function btnH()        { return portrait() ? 44 : 36; }
const BTN_GAP  = 8;
const BTN_PAD  = 12;
function bottomReserved() { return portrait() ? 16 : 12; }

export class InventoryUI {
  /** @param {{ bus: object, materialDefs?: Record<string, object> }} deps */
  constructor({ bus, materialDefs = {} }) {
    this.bus = bus;
    this.materialDefs = materialDefs;
    this.open = false;
    bus.on('request:newRun', () => this.hide());
    bus.on('scene:switched', ({ to }) => {
      if (to !== 'game') this.hide();
    });
    this.activeTab = 'all';
    /** Selected slot INDEX in the filtered view (not absolute inventory index). */
    this.selectedFilteredIdx = 0;
    /** Tooltip — second tap on the same already-selected slot opens it. */
    this.tooltip = new Tooltip();
  }

  toggle() {
    this.open = !this.open;
    if (this.open) { this.selectedFilteredIdx = 0; this.activeTab = 'all'; }
  }
  show() { this.open = true; this.selectedFilteredIdx = 0; this.activeTab = 'all'; }
  hide() { this.open = false; }

  // --- filter logic --------------------------------------------------
  /**
   * Map an item to its category id. Pure function so tabs and rendering
   * use the same classification.
   */
  static categorize(item) {
    if (!item) return null;
    const t = item.type || '';
    if (t === 'weapon')     return 'arms';
    if (t === 'armor' || t === 'helm' || t === 'legs' ||
        t === 'necklace' || t === 'ring') return 'garb';
    if (t === 'throwable')  return 'thrown';
    if (t === 'passive')    return 'charms';
    if (t === 'consumable') return 'phial';
    if (t === 'material')   return 'mats';
    return 'phial';
  }

  /** @returns {Array<{ item: object|null, slotIndex: number }>} */
  _filteredView(player) {
    if (this.activeTab === 'mats') return this._materialView(player);

    const out = [];
    for (let i = 0; i < player.inventory.size; i++) {
      const item = player.inventory.getSlot(i);
      if (this.activeTab === 'all') {
        out.push({ item, slotIndex: i });
      } else if (item && InventoryUI.categorize(item) === this.activeTab) {
        out.push({ item, slotIndex: i });
      }
    }
    return out;
  }

  _materialView(player) {
    const materials = player.materials || {};
    const ids = new Set([
      ...Object.keys(this.materialDefs),
      ...Object.keys(materials)
    ]);
    return Array.from(ids)
      .map((id) => [id, materials[id] || 0])
      .sort(([a], [b]) => this._materialName(a).localeCompare(this._materialName(b)))
      .map(([id, count], index) => ({
        item: this._materialItem(id, count),
        slotIndex: index,
        material: true
      }));
  }

  _materialName(id) {
    return this.materialDefs[id]?.name || id.replace(/_/g, ' ');
  }

  _materialItem(id, count) {
    const def = this.materialDefs[id] || {
      id,
      name: this._materialName(id),
      type: 'material',
      rarity: 'common',
      spriteKey: 'item_default',
      stackable: true,
      maxStack: 999,
      lore: 'A crafting material stored in the material pouch.'
    };
    return {
      ...def,
      id,
      name: def.name || this._materialName(id),
      type: 'material',
      rarity: def.rarity || 'common',
      spriteKey: def.spriteKey || 'item_default',
      stackable: true,
      maxStack: 999,
      count,
      lore: def.lore || 'Stored safely in the material pouch.',
      materialPouch: true
    };
  }

  _selectedItem(player) {
    const view = this._filteredView(player);
    const entry = view[this.selectedFilteredIdx];
    return entry?.item || null;
  }
  _selectedSlotIndex(player) {
    const view = this._filteredView(player);
    return view[this.selectedFilteredIdx]?.slotIndex ?? -1;
  }

  // --- input ---------------------------------------------------------
  handleInput(player, input) {
    if (!this.open) return false;
    const view = this._filteredView(player);
    const total = Math.max(1, view.length);
    switch (input.type) {
      case 'move': {
        const dx = input.dx || 0, dy = input.dy || 0;
        let s = this.selectedFilteredIdx + dx + dy * gridCols();
        s = ((s % total) + total) % total;
        this.selectedFilteredIdx = s;
        return true;
      }
      case 'confirm':
      case 'pickup':
        this._activateSelected(player);
        return true;
      case 'drop':
        this._dropSelected(player);
        return true;
      case 'inventory':
      case 'escape':
        this.hide();
        return true;
      case 'useSlot':
        // Hotkey 1-9 still works — find slot in current view.
        if (typeof input.index === 'number') {
          const entry = view.find((e) => e.slotIndex === input.index);
          if (entry) {
            this.selectedFilteredIdx = view.indexOf(entry);
            this._activateSelected(player);
          }
        }
        return true;
      default:
        return true;
    }
  }

  handleCanvasTap(canvasX, canvasY, player) {
    if (!this.open) return false;
    if (this._insideHeaderBack(canvasX, canvasY)) {
      this.hide();
      return true;
    }

    // 1. Tabs.
    const tabIdx = this._tabHitTest(canvasX, canvasY);
    if (tabIdx >= 0) {
      this.activeTab = TABS[tabIdx].id;
      this.selectedFilteredIdx = 0;
      return true;
    }

    // 2. Action buttons (USE / EQUIP / DROP / CLOSE).
    const btnIdx = this._hitTestButtons(canvasX, canvasY);
    if (btnIdx >= 0) {
      if (btnIdx === 0) this._activateSelected(player);
      else if (btnIdx === 1) this._dropSelected(player);
      else if (btnIdx === 2) this.hide();
      return true;
    }

    // 3. Slot grid.
    const view = this._filteredView(player);
    const grid = this._gridGeometry();
    const { cols, size, pad } = grid;
    const step = size + pad;
    for (let i = 0; i < view.length; i++) {
      const cx = grid.startX + (i % cols) * step;
      const cy = grid.startY + Math.floor(i / cols) * step;
      if (canvasX >= cx && canvasX <= cx + size &&
          canvasY >= cy && canvasY <= cy + size) {
        // Second tap on the already-selected slot opens the tooltip;
        // tapping a different slot just re-selects.
        if (this.selectedFilteredIdx === i) {
          const item = this._selectedItem(player);
          if (item) {
            const meta = this._metaRef();
            if (this.tooltip.open && this.tooltip.item === item) this.tooltip.hide();
            else this.tooltip.show(item,
              { x: cx, y: cy, w: size, h: size }, meta);
          }
        } else {
          this.tooltip.hide();
          this.selectedFilteredIdx = i;
        }
        return true;
      }
    }
    // Tap outside grid closes the tooltip.
    this.tooltip.hide();
    return true;
  }

  /** Best-effort meta accessor for the identification check. */
  _metaRef() {
    // The state store is global on the bus; let the Tooltip degrade
    // gracefully if we can't find it.
    try { return globalThis.__shadowDepthsMeta || null; } catch { return null; }
  }

  _activateSelected(player) {
    const item = this._selectedItem(player);
    const slotIndex = this._selectedSlotIndex(player);
    if (!item || slotIndex < 0) return;
    if (item.materialPouch) return;
    if (item.slot) this.bus.emit('command:equipSlot', { index: slotIndex });
    else this.bus.emit('command:useSlot', { index: slotIndex });
  }
  _dropSelected(player) {
    const item = this._selectedItem(player);
    if (item?.materialPouch) return;
    const slotIndex = this._selectedSlotIndex(player);
    if (slotIndex < 0) return;
    this.bus.emit('command:dropSlot', { index: slotIndex });
  }

  // --- geometry ------------------------------------------------------
  _gridGeometry() {
    const cols = gridCols();
    const size = slotSize();
    const pad = slotPadding();
    const totalW = cols * size + (cols - 1) * pad;
    return {
      startX: (screenW() - totalW) / 2,
      startY: gridTop(),
      totalW,
      cols,
      size,
      pad
    };
  }

  _tabsGeometry() {
    const tabW = (screenW() - 24) / TABS.length;
    return { tabW, baseX: 12, y: tabY() };
  }

  _tabHitTest(x, y) {
    const g = this._tabsGeometry();
    if (y < g.y || y > g.y + tabH()) return -1;
    const idx = Math.floor((x - g.baseX) / g.tabW);
    if (idx < 0 || idx >= TABS.length) return -1;
    return idx;
  }

  _hitTestButtons(x, y) {
    const layout = this._buttonLayout();
    for (let i = 0; i < layout.length; i++) {
      const b = layout[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
    }
    return -1;
  }

  _buttonLayout() {
    const count = 3;
    const totalW = screenW() - BTN_PAD * 2;
    const w = (totalW - BTN_GAP * (count - 1)) / count;
    const h = btnH();
    const y = screenH() - h - BTN_PAD - bottomReserved();
    return [
      { x: BTN_PAD,                        y, w, h, key: 'use' },
      { x: BTN_PAD + (w + BTN_GAP),        y, w, h, key: 'drop' },
      { x: BTN_PAD + 2 * (w + BTN_GAP),    y, w, h, key: 'close' }
    ];
  }

  _insideHeaderBack(x, y) {
    const h = portrait() ? 38 : 30;
    return x >= 0 && x <= 154 && y >= 0 && y <= h;
  }

  // --- render --------------------------------------------------------
  render(renderer, player) {
    if (!this.open) return;
    const w = screenW();
    const h = screenH();

    // Full-bleed iron panel chrome covers the entire modal area.
    drawIronPanel(renderer.ctx, 0, 0, w, h);

    this._renderHeader(renderer, player);
    this._renderTabs(renderer, player);
    this._renderGrid(renderer, player);
    this._renderDetailCard(renderer, player);
    this._renderActionButtons(renderer, player);
    // Tooltip rendered last so it sits on top of everything else.
    if (this.tooltip) this.tooltip.render(renderer);
  }

  _renderHeader(r, player) {
    const ctx = r.ctx;
    // Iron back button (left).
    drawIronPlate(ctx, 10, 18, 38, 38, { rivets: true });
    r.drawText('◀', 29, 37, {
      size: uiSize(18), align: 'center', baseline: 'middle',
      family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });

    // SATCHEL title + count.
    ctx.save();
    ctx.font = `bold ${uiSize(16)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = IRON_PALETTE.bone;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    drawSpacedText.call(null, ctx, 'SATCHEL', 60 + ctx.measureText('SATCHEL').width / 2, 22, 4);
    ctx.restore();
    const filled = player.inventory.slots.filter(Boolean).length;
    const matTotal = Object.values(player.materials || {}).reduce((sum, n) => sum + n, 0);
    const matKinds = Object.keys(this.materialDefs).length;
    const matOwned = Object.values(player.materials || {}).filter((n) => n > 0).length;
    const countText = this.activeTab === 'mats'
      ? `RESOURCES ${matTotal} TOTAL · ${matOwned}/${matKinds} TYPES`
      : `${filled} / ${player.inventory.size}`;
    r.drawText(countText, 60, 44, {
      size: uiSize(10), family: FONT_MONO, color: IRON_PALETTE.boneDim
    });

    // Coins pill (right) — small iron plate w/ brass accent.
    const coinText = `${player.gold}`;
    ctx.font = `bold ${uiSize(13)}px ${FONT_MONO}`;
    const coinW = Math.max(56, ctx.measureText(`◈${coinText}`).width + 22);
    const coinX = screenW() - coinW - 12;
    drawIronPlate(ctx, coinX, 22, coinW, 30, { rivets: false, glow: IRON_PALETTE.brass });
    r.drawText('◈', coinX + 10, 37, {
      size: uiSize(13), baseline: 'middle', family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });
    r.drawText(coinText, coinX + coinW - 10, 37, {
      size: uiSize(13), bold: true, align: 'right', baseline: 'middle',
      family: FONT_MONO, color: IRON_PALETTE.brass
    });
  }

  _renderTabs(r, _player) {
    const g = this._tabsGeometry();
    const ctx = r.ctx;
    const th = tabH();
    for (let i = 0; i < TABS.length; i++) {
      const x = g.baseX + i * g.tabW;
      const active = TABS[i].id === this.activeTab;
      drawIronPlate(ctx, x + 2, g.y, g.tabW - 4, th, {
        pressed: active,
        glow: active ? IRON_PALETTE.brass : null,
        rivets: false
      });
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, g.y, g.tabW - 4, th);
      ctx.clip();
      const label = TABS[i].label.toUpperCase();
      const maxW = g.tabW - 10;
      let fontSize = label.length >= 5 ? 9 : 10;
      let spacing = label.length >= 5 ? 0.5 : 1;
      ctx.font = `bold ${uiSize(fontSize)}px ${FONT_DISPLAY}`;
      while (fontSize > 7 && this._spacedTextWidth(ctx, label, spacing) > maxW) {
        fontSize -= 1;
        spacing = Math.max(0, spacing - 0.25);
        ctx.font = `bold ${uiSize(fontSize)}px ${FONT_DISPLAY}`;
      }
      ctx.fillStyle = active ? IRON_PALETTE.brass : IRON_PALETTE.boneDim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawSpacedText(ctx, label, x + g.tabW / 2, g.y + th / 2, spacing);
      ctx.restore();
    }
  }

  _spacedTextWidth(ctx, text, spacing) {
    let total = 0;
    for (let i = 0; i < text.length; i++) {
      total += ctx.measureText(text[i]).width;
      if (i < text.length - 1) total += spacing;
    }
    return total;
  }

  _countForTab(player, tabId) {
    if (tabId === 'all') return player.inventory.slots.filter(Boolean).length;
    let n = 0;
    for (const slot of player.inventory.slots) {
      if (slot && InventoryUI.categorize(slot) === tabId) n++;
    }
    return n;
  }

  _renderGrid(r, player) {
    const ctx = r.ctx;
    const view = this._filteredView(player);
    const grid = this._gridGeometry();
    const { cols, size, pad } = grid;
    const step = size + pad;
    const maxSlots = this.activeTab === 'all'
      ? player.inventory.size
      : Math.max(view.length, cols);
    for (let i = 0; i < Math.max(view.length, maxSlots); i++) {
      const cx = grid.startX + (i % cols) * step;
      const cy = grid.startY + Math.floor(i / cols) * step;
      const entry = view[i];
      const sel = i === this.selectedFilteredIdx;
      // Iron recessed slot with rarity-coloured border (or brass when selected).
      drawIronSlot(ctx, cx, cy, size, size, {
        selected: sel,
        rarity: entry?.item?.rarity,
        empty: !entry?.item
      });
      // Slot index badge top-left.
      if (entry && this.activeTab === 'all') {
        r.drawText(String(entry.slotIndex + 1), cx + 8, cy + 6,
          { size: uiSize(10), family: FONT_MONO, color: IRON_PALETTE.brass });
      } else if (entry?.material) {
        r.drawText('RES', cx + 8, cy + 6,
          { size: uiSize(9), family: FONT_MONO, color: IRON_PALETTE.brass });
      }
      if (entry?.item) {
        const iconPad = 14;
        const icon = size - iconPad * 2;
        if (entry.material && entry.item.count <= 0) ctx.globalAlpha = 0.38;
        r.sprites.draw(entry.item.spriteKey, r.ctx, cx + iconPad, cy + iconPad, { size: icon });
        if (entry.material && entry.item.count <= 0) ctx.globalAlpha = 1;
        // Equipped badge.
        const isEq = entry.item === player.weapon || entry.item === player.armor
                  || entry.item === player.helm   || entry.item === player.legs
                  || entry.item === player.necklace || entry.item === player.ring;
        if (isEq) {
          r.drawRect(cx + size - 18, cy + 6, 14, 14, IRON_PALETTE.brass);
          r.drawStrokedRect(cx + size - 18, cy + 6, 14, 14, IRON_PALETTE.ink, 1);
          r.drawText('E', cx + size - 11, cy + 13, {
            size: uiSize(9), bold: true, align: 'center', baseline: 'middle',
            family: FONT_MONO, color: IRON_PALETTE.ink
          });
        }
        // Stack count.
        if (entry.item.materialPouch || (entry.item.stackable && entry.item.count > 1)) {
          r.drawText(`×${entry.item.count}`, cx + size - 8, cy + size - 8,
            { size: uiSize(11), bold: true, align: 'right', baseline: 'bottom',
              family: FONT_MONO,
              color: entry.item.count > 0 ? IRON_PALETTE.bone : IRON_PALETTE.boneDim });
        }
      }
    }
  }

  _renderDetailCard(r, player) {
    const ctx = r.ctx;
    const sel = this._selectedItem(player);
    const buttons = this._buttonLayout();
    const dh = detailH();
    const cardY = buttons[0].y - dh - 8;
    const cardX = 12;
    const cardW = screenW() - 24;
    drawInsetCard(ctx, cardX, cardY, cardW, dh, {
      borderColor: sel ? ironRarity(sel.rarity) : IRON_PALETTE.plate2
    });

    if (!sel) {
      r.drawText('— no item selected —', screenW() / 2, cardY + dh / 2,
        { size: uiSize(13), italic: true, align: 'center', baseline: 'middle',
          family: FONT_BODY, color: IRON_PALETTE.boneDim });
      return;
    }

    const col = ironRarity(sel.rarity);
    // Icon recess on the left (matches mock — square with rarity border + glow).
    const iconSize = dh - 28;
    const iconX = cardX + 14;
    const iconY = cardY + 14;
    ctx.fillStyle = IRON_PALETTE.ink;
    ctx.fillRect(iconX, iconY, iconSize, iconSize);
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.strokeRect(iconX + 0.5, iconY + 0.5, iconSize - 1, iconSize - 1);
    ctx.restore();
    r.sprites.draw(sel.spriteKey, r.ctx, iconX + 4, iconY + 4, { size: iconSize - 8 });

    // Name (rarity-coloured, display serif).
    const textX = iconX + iconSize + 14;
    ctx.save();
    ctx.font = `bold ${uiSize(14)}px ${FONT_DISPLAY}`;
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    drawSpacedText(ctx, sel.name.toUpperCase(),
      textX + ctx.measureText(sel.name.toUpperCase()).width / 2, cardY + 16, 1.5);
    ctx.restore();

    // type · rarity sublabel.
    const sub = `${(sel.slot || sel.type || '').toUpperCase()} · ${sel.rarity.toUpperCase()}`;
    ctx.save();
    ctx.font = `${uiSize(9)}px ${FONT_MONO}`;
    ctx.fillStyle = IRON_PALETTE.boneDim;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    drawSpacedText(ctx, sub,
      textX + ctx.measureText(sub).width / 2, cardY + 36, 1.5);
    ctx.restore();

    // Equipped chip (small brass tag).
    const isEq = sel === player.weapon || sel === player.armor
              || sel === player.helm || sel === player.legs
              || sel === player.necklace || sel === player.ring;
    if (isEq) {
      const chipW = 64, chipH = 16;
      const chipX = cardX + cardW - chipW - 12;
      const chipY = cardY + 14;
      ctx.fillStyle = IRON_PALETTE.brass;
      ctx.fillRect(chipX, chipY, chipW, chipH);
      ctx.strokeStyle = IRON_PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(chipX + 0.5, chipY + 0.5, chipW - 1, chipH - 1);
      ctx.save();
      ctx.font = `bold ${uiSize(9)}px ${FONT_DISPLAY}`;
      ctx.fillStyle = IRON_PALETTE.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawSpacedText(ctx, 'EQUIPPED', chipX + chipW / 2, chipY + chipH / 2, 1.5);
      ctx.restore();
    }

    // Stat line.
    r.drawText(this._fitLine(r, this._statLine(sel), cardW - (textX - cardX) - 14, uiSize(11)),
      textX, cardY + 52,
      { size: uiSize(11), family: FONT_MONO, color: IRON_PALETTE.bone });

    // Lore quote in a brass-left-trim box (matches mock).
    if (sel.lore) {
      const loreY = cardY + 72;
      const loreH = dh - (loreY - cardY) - 10;
      const loreX = textX;
      const loreW = cardW - (textX - cardX) - 14;
      ctx.fillStyle = IRON_PALETTE.ink;
      ctx.fillRect(loreX, loreY, loreW, loreH);
      ctx.fillStyle = IRON_PALETTE.brass;
      ctx.fillRect(loreX, loreY, 2, loreH);
      this._drawWrappedText(r, `"${sel.lore}"`, loreX + 8, loreY + 6, loreW - 12, 2, {
        size: uiSize(10), italic: true, family: FONT_BODY, color: IRON_PALETTE.boneDim
      });
    }
  }

  _renderActionButtons(r, player) {
    const buttons = this._buttonLayout();
    const sel = this._selectedItem(player);
    const isEquipped = sel && (sel === player.weapon || sel === player.armor ||
                                sel === player.helm   || sel === player.legs ||
                                sel === player.necklace || sel === player.ring);
    const pouchItem = !!sel?.materialPouch;
    const useLabel = pouchItem ? 'POUCH'
      : !sel ? 'USE'
      : sel.slot ? (isEquipped ? 'UNEQUIP' : 'EQUIP')
      : 'USE';
    const items = [
      { text: useLabel, enabled: !!sel && !pouchItem, accent: sel ? IRON_PALETTE.ember : null },
      { text: 'DROP',   enabled: !!sel && !pouchItem },
      { text: 'CLOSE',  enabled: true,  accent: IRON_PALETTE.brass }
    ];
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      drawIronActionButton(r, b.x, b.y, b.w, b.h, items[i].text, {
        disabled: !items[i].enabled,
        accent: items[i].accent
      });
    }
  }

  _statLine(item) {
    if (item.materialPouch) return `Stored x${item.count}   Resource pouch   Forge currency`;
    const parts = [];
    if (item.stats?.atk)   parts.push(`+${item.stats.atk} ATK`);
    if (item.stats?.def)   parts.push(`+${item.stats.def} DEF`);
    if (item.stats?.dex)   parts.push(`${item.stats.dex >= 0 ? '+' : ''}${item.stats.dex} DEX`);
    if (item.stats?.critBonus) parts.push(`+${Math.round(item.stats.critBonus * 100)}% CRIT`);
    if (item.stats?.attackRange && item.stats.attackRange > 1) {
      parts.push(`Range ${item.stats.attackRange}`);
    }
    if (item.stats?.hpMaxBonus) parts.push(`+${item.stats.hpMaxBonus} max HP`);
    if (item.onHit?.[0]?.type === 'lifesteal') {
      parts.push(`Lifesteal ${Math.round(item.onHit[0].value * 100)}%`);
    }
    if (item.effects) {
      for (const e of item.effects) {
        if (e.type === 'heal') parts.push(`Heal ${e.value}`);
        if (e.type === 'maxHP') parts.push(`+${e.value} max HP`);
        if (e.type === 'grantXP') parts.push(`+${e.value} XP`);
        if (e.type === 'applyStatus') parts.push(`${e.status} ${e.value}×${e.duration}t`);
        if (e.type === 'aoe_damage') parts.push(`AOE ${e.value} r${e.radius}${e.friendlyFire ? ' (self)' : ''}`);
        if (e.type === 'revealFloor') parts.push('Reveal floor');
        if (e.type === 'autoReviveOnce') parts.push('Auto-revive');
      }
    }
    return parts.join('   ') || item.type;
  }

  _fitLine(r, text, maxW, size) {
    const opts = { size, family: FONT_MONO };
    if (r.measureText(text, opts) <= maxW) return text;
    const ellipsis = '...';
    let out = text;
    while (out.length > 0 && r.measureText(out + ellipsis, opts) > maxW) {
      out = out.slice(0, -1);
    }
    return out ? out + ellipsis : ellipsis;
  }

  _drawWrappedText(r, text, x, y, maxW, maxLines, opts) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (r.measureText(next, opts) <= maxW) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
      let last = lines[maxLines - 1];
      while (last.length > 0 && r.measureText(`${last}...`, opts) > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}...`;
    }
    for (let i = 0; i < lines.length; i++) {
      r.drawText(lines[i], x, y + i * 16, opts);
    }
  }
}

/**
 * InventoryUI — mock-matched satchel screen.
 *
 * Layout:
 *   1. Header: "SATCHEL" + count "X / Y" + coin balance
 *   2. Tab strip: ALL · ARMS · GARB · PHIAL · THROWN · CHARMS
 *   3. Slot grid (filtered by active tab)
 *   4. Selected item detail card (name + rarity chip + stats + lore + action button)
 *
 * The grid shows only slots matching the active tab. Tabs are taps, no
 * keyboard binding (mobile-first). Detail card replaces the old tooltip
 * line — bigger, easier to read on phones.
 */
import {
  COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE,
  FONT_DISPLAY, FONT_BODY, FONT_MONO
} from '../config/constants.js';

const TABS = [
  { id: 'all',     label: 'ALL'    },
  { id: 'arms',    label: 'ARMS'   },
  { id: 'garb',    label: 'GARB'   },
  { id: 'phial',   label: 'PHIAL'  },
  { id: 'thrown',  label: 'THROWN' },
  { id: 'charms',  label: 'CHARMS' }
];

const SLOT_SIZE    = IS_LANDSCAPE ? 56 : 80;
const SLOT_PADDING = IS_LANDSCAPE ? 6  : 8;
const COLS         = IS_LANDSCAPE ? 4  : 3;
const GRID_TOP     = IS_LANDSCAPE ? 92 : 116;

const TAB_H = IS_LANDSCAPE ? 28 : 32;
const TAB_Y = IS_LANDSCAPE ? 56 : 78;

const DETAIL_H = IS_LANDSCAPE ? 110 : 140;
const BTN_H    = IS_LANDSCAPE ? 36 : 44;
const BTN_GAP  = 8;
const BTN_PAD  = 12;
const BOTTOM_RESERVED = IS_LANDSCAPE ? 12 : 96;

export class InventoryUI {
  /** @param {{ bus: object }} deps */
  constructor({ bus }) {
    this.bus = bus;
    this.open = false;
    this.activeTab = 'all';
    /** Selected slot INDEX in the filtered view (not absolute inventory index). */
    this.selectedFilteredIdx = 0;
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
    if (t === 'armor' || t === 'helm' || t === 'ring') return 'garb';
    if (t === 'throwable')  return 'thrown';
    if (t === 'passive')    return 'charms';
    if (t === 'consumable') return 'phial';
    return 'phial';
  }

  /** @returns {Array<{ item: object|null, slotIndex: number }>} */
  _filteredView(player) {
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
        let s = this.selectedFilteredIdx + dx + dy * COLS;
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
    for (let i = 0; i < view.length; i++) {
      const cx = grid.startX + (i % COLS) * (SLOT_SIZE + SLOT_PADDING);
      const cy = grid.startY + Math.floor(i / COLS) * (SLOT_SIZE + SLOT_PADDING);
      if (canvasX >= cx && canvasX <= cx + SLOT_SIZE &&
          canvasY >= cy && canvasY <= cy + SLOT_SIZE) {
        this.selectedFilteredIdx = i;
        return true;
      }
    }
    return true;
  }

  _activateSelected(player) {
    const item = this._selectedItem(player);
    const slotIndex = this._selectedSlotIndex(player);
    if (!item || slotIndex < 0) return;
    if (item.slot) this.bus.emit('command:equipSlot', { index: slotIndex });
    else this.bus.emit('command:useSlot', { index: slotIndex });
  }
  _dropSelected(player) {
    const slotIndex = this._selectedSlotIndex(player);
    if (slotIndex < 0) return;
    this.bus.emit('command:dropSlot', { index: slotIndex });
  }

  // --- geometry ------------------------------------------------------
  _gridGeometry() {
    const totalW = COLS * SLOT_SIZE + (COLS - 1) * SLOT_PADDING;
    return {
      startX: (CANVAS_WIDTH - totalW) / 2,
      startY: GRID_TOP,
      totalW
    };
  }

  _tabsGeometry() {
    const tabW = (CANVAS_WIDTH - 24) / TABS.length;
    return { tabW, baseX: 12, y: TAB_Y };
  }

  _tabHitTest(x, y) {
    const g = this._tabsGeometry();
    if (y < g.y || y > g.y + TAB_H) return -1;
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
    const totalW = CANVAS_WIDTH - BTN_PAD * 2;
    const w = (totalW - BTN_GAP * (count - 1)) / count;
    const y = CANVAS_HEIGHT - BTN_H - BTN_PAD - BOTTOM_RESERVED;
    return [
      { x: BTN_PAD,                        y, w, h: BTN_H, key: 'use' },
      { x: BTN_PAD + (w + BTN_GAP),        y, w, h: BTN_H, key: 'drop' },
      { x: BTN_PAD + 2 * (w + BTN_GAP),    y, w, h: BTN_H, key: 'close' }
    ];
  }

  // --- render --------------------------------------------------------
  render(renderer, player) {
    if (!this.open) return;

    renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, COLOR.bg);

    this._renderHeader(renderer, player);
    this._renderTabs(renderer, player);
    this._renderGrid(renderer, player);
    this._renderDetailCard(renderer, player);
    this._renderActionButtons(renderer, player);
  }

  _renderHeader(r, player) {
    const top = IS_LANDSCAPE ? 6 : 16;
    // Top bar with back arrow.
    r.drawRect(0, 0, CANVAS_WIDTH, IS_LANDSCAPE ? 30 : 38, COLOR.bgPanel);
    r.drawText('◀ SATCHEL', 12, top,
      { size: 12, family: FONT_DISPLAY, color: COLOR.gold });
    // Count badge.
    const filled = player.inventory.slots.filter(Boolean).length;
    r.drawText(`${filled} / ${player.inventory.size}`,
      CANVAS_WIDTH / 2, top, {
        size: 11, align: 'center', family: FONT_MONO, color: COLOR.textPrimary
      });
    // Coins.
    r.drawText(`◈ ${player.gold}`, CANVAS_WIDTH - 12, top,
      { size: 11, align: 'right', family: FONT_MONO, color: COLOR.textXP });
  }

  _renderTabs(r, player) {
    const g = this._tabsGeometry();
    for (let i = 0; i < TABS.length; i++) {
      const x = g.baseX + i * g.tabW;
      const active = TABS[i].id === this.activeTab;
      const count = this._countForTab(player, TABS[i].id);
      r.drawRect(x + 2, g.y, g.tabW - 4, TAB_H, active ? COLOR.bgCardHi : COLOR.bgCard);
      r.drawStrokedRect(x + 2, g.y, g.tabW - 4, TAB_H,
        active ? COLOR.gold : COLOR.borderSoft, active ? 2 : 1);
      r.drawText(TABS[i].label, x + g.tabW / 2, g.y + TAB_H / 2 - 4,
        { size: 10, bold: true, align: 'center', baseline: 'middle',
          family: FONT_DISPLAY, color: active ? COLOR.gold : COLOR.textMuted });
      if (count > 0) {
        r.drawText(String(count), x + g.tabW / 2, g.y + TAB_H - 8,
          { size: 9, align: 'center', baseline: 'middle',
            family: FONT_MONO, color: COLOR.textMuted });
      }
    }
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
    const view = this._filteredView(player);
    const grid = this._gridGeometry();
    // Always reserve grid space (max slots = inventory.size).
    const maxSlots = this.activeTab === 'all'
      ? player.inventory.size
      : Math.max(view.length, COLS);
    for (let i = 0; i < Math.max(view.length, maxSlots); i++) {
      const cx = grid.startX + (i % COLS) * (SLOT_SIZE + SLOT_PADDING);
      const cy = grid.startY + Math.floor(i / COLS) * (SLOT_SIZE + SLOT_PADDING);
      const entry = view[i];
      const sel = i === this.selectedFilteredIdx;
      const rarityCol = entry?.item ? rarityColor(entry.item.rarity) : COLOR.borderSoft;
      r.drawRect(cx, cy, SLOT_SIZE, SLOT_SIZE, sel ? COLOR.bgCardHi : COLOR.bgCard);
      r.drawStrokedRect(cx, cy, SLOT_SIZE, SLOT_SIZE,
        sel ? COLOR.gold : rarityCol, sel ? 3 : 1);
      // Slot number badge in corner.
      if (entry && this.activeTab === 'all') {
        r.drawText(String(entry.slotIndex + 1), cx + 4, cy + 2,
          { size: 9, family: FONT_MONO, color: COLOR.textMuted });
      }
      if (entry?.item) {
        const icon = SLOT_SIZE - 24;
        r.sprites.draw(entry.item.spriteKey, r.ctx, cx + 12, cy + 12, { size: icon });
        if (entry.item.stackable && entry.item.count > 1) {
          r.drawText(`×${entry.item.count}`, cx + SLOT_SIZE - 4, cy + SLOT_SIZE - 4,
            { size: 11, bold: true, align: 'right', baseline: 'bottom',
              family: FONT_MONO, color: COLOR.textPrimary });
        }
        // Rarity chip in corner.
        const rarity = (entry.item.rarity || 'common').charAt(0).toUpperCase();
        r.drawRect(cx + SLOT_SIZE - 14, cy + 2, 12, 12, rarityCol);
        r.drawText(rarity, cx + SLOT_SIZE - 8, cy + 8,
          { size: 9, bold: true, align: 'center', baseline: 'middle',
            family: FONT_DISPLAY, color: '#0a0608' });
      }
    }
  }

  _renderDetailCard(r, player) {
    const sel = this._selectedItem(player);
    const buttons = this._buttonLayout();
    const cardY = buttons[0].y - DETAIL_H - 8;
    const cardX = 12;
    const cardW = CANVAS_WIDTH - 24;
    r.drawRect(cardX, cardY, cardW, DETAIL_H, COLOR.bgCard);
    r.drawStrokedRect(cardX, cardY, cardW, DETAIL_H,
      sel ? rarityColor(sel.rarity) : COLOR.borderSoft, sel ? 2 : 1);

    if (!sel) {
      r.drawText('— no item selected —', CANVAS_WIDTH / 2, cardY + DETAIL_H / 2,
        { size: 12, italic: true, align: 'center', baseline: 'middle',
          family: FONT_BODY, color: COLOR.textMuted });
      return;
    }

    // Icon on the left.
    const iconSize = DETAIL_H - 24;
    const iconX = cardX + 12;
    const iconY = cardY + 12;
    r.drawRect(iconX, iconY, iconSize, iconSize, COLOR.bgPanelAlt);
    r.sprites.draw(sel.spriteKey, r.ctx, iconX, iconY, { size: iconSize });

    // Name + rarity chip on right of icon.
    const textX = iconX + iconSize + 14;
    r.drawText(sel.name, textX, cardY + 12,
      { size: 16, bold: true, family: FONT_DISPLAY, color: rarityColor(sel.rarity) });
    // Rarity chip.
    const rarityW = 60;
    const chipY = cardY + 36;
    r.drawRect(textX, chipY, rarityW, 16, rarityColor(sel.rarity));
    r.drawText(sel.rarity.toUpperCase(), textX + rarityW / 2, chipY + 8,
      { size: 9, bold: true, align: 'center', baseline: 'middle',
        family: FONT_DISPLAY, color: '#0a0608' });
    // Type chip next to rarity.
    const typeChip = sel.slot ? sel.slot.toUpperCase() : sel.type.toUpperCase();
    r.drawText(typeChip, textX + rarityW + 8, chipY + 8,
      { size: 9, bold: true, baseline: 'middle',
        family: FONT_DISPLAY, color: COLOR.textMuted });
    // Equipped chip.
    if ((sel === player.weapon) || (sel === player.armor) ||
        (sel === player.helm)   || (sel === player.ring)) {
      r.drawText('EQUIPPED', textX + rarityW + 100, chipY + 8,
        { size: 9, bold: true, baseline: 'middle',
          family: FONT_DISPLAY, color: COLOR.gold });
    }

    // Stat line.
    r.drawText(this._statLine(sel), textX, cardY + 62,
      { size: 11, family: FONT_MONO, color: COLOR.textPrimary });
    // Lore line.
    r.drawText(`"${sel.lore}"`, textX, cardY + 84,
      { size: 11, italic: true, family: FONT_BODY, color: COLOR.textMuted });
  }

  _renderActionButtons(r, player) {
    const buttons = this._buttonLayout();
    const sel = this._selectedItem(player);
    const isEquipped = sel && (sel === player.weapon || sel === player.armor ||
                                sel === player.helm   || sel === player.ring);
    const labels = [
      { text: !sel ? 'USE' : (sel.slot ? (isEquipped ? 'EQUIP' : 'EQUIP') : 'USE'),
        enabled: !!sel },
      { text: 'DROP',  enabled: !!sel },
      { text: 'CLOSE', enabled: true }
    ];
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      const enabled = labels[i].enabled;
      r.drawRect(b.x, b.y, b.w, b.h, enabled ? COLOR.bgCardHi : COLOR.bgPanelAlt);
      r.drawStrokedRect(b.x, b.y, b.w, b.h, enabled ? COLOR.gold : COLOR.borderSoft, enabled ? 2 : 1);
      r.drawText(labels[i].text, b.x + b.w / 2, b.y + b.h / 2,
        { size: 13, bold: true, align: 'center', baseline: 'middle',
          family: FONT_DISPLAY,
          color: enabled ? COLOR.textPrimary : COLOR.textMuted });
    }
  }

  _statLine(item) {
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
}

function rarityColor(r) {
  switch (r) {
    case 'uncommon': return COLOR.itemUncommon;
    case 'rare':     return COLOR.itemRare;
    case 'epic':     return COLOR.itemEpic;
    default:         return COLOR.itemCommon;
  }
}

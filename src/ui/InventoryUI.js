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
  FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import {
  drawIronPanel, drawIronPlate, drawIronSlot, drawInsetCard,
  drawIronActionButton, drawSpacedText, IRON_PALETTE,
  rarityColor as ironRarity
} from './ironPanel.js';

const TABS = [
  { id: 'all',     label: 'ALL'    },
  { id: 'arms',    label: 'ARMS'   },
  { id: 'garb',    label: 'GARB'   },
  { id: 'phial',   label: 'PHIAL'  },
  { id: 'thrown',  label: 'THROW'  },
  { id: 'charms',  label: 'CHARM'  }
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
const BOTTOM_RESERVED = IS_LANDSCAPE ? 12 : 16;

export class InventoryUI {
  /** @param {{ bus: object }} deps */
  constructor({ bus }) {
    this.bus = bus;
    this.open = false;
    bus.on('request:newRun', () => this.hide());
    bus.on('scene:switched', ({ to }) => {
      if (to !== 'game') this.hide();
    });
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
    if (t === 'armor' || t === 'helm' || t === 'legs' ||
        t === 'necklace' || t === 'ring') return 'garb';
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
    const screenH = Layout.canvasH || CANVAS_HEIGHT;
    const y = screenH - BTN_H - BTN_PAD - BOTTOM_RESERVED;
    return [
      { x: BTN_PAD,                        y, w, h: BTN_H, key: 'use' },
      { x: BTN_PAD + (w + BTN_GAP),        y, w, h: BTN_H, key: 'drop' },
      { x: BTN_PAD + 2 * (w + BTN_GAP),    y, w, h: BTN_H, key: 'close' }
    ];
  }

  _insideHeaderBack(x, y) {
    const h = IS_LANDSCAPE ? 30 : 38;
    return x >= 0 && x <= 154 && y >= 0 && y <= h;
  }

  // --- render --------------------------------------------------------
  render(renderer, player) {
    if (!this.open) return;
    const screenH = Layout.canvasH || CANVAS_HEIGHT;

    // Full-bleed iron panel chrome covers the entire modal area.
    drawIronPanel(renderer.ctx, 0, 0, CANVAS_WIDTH, screenH);

    this._renderHeader(renderer, player);
    this._renderTabs(renderer, player);
    this._renderGrid(renderer, player);
    this._renderDetailCard(renderer, player);
    this._renderActionButtons(renderer, player);
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
    r.drawText(`${filled} / ${player.inventory.size}`, 60, 44, {
      size: uiSize(10), family: FONT_MONO, color: IRON_PALETTE.boneDim
    });

    // Coins pill (right) — small iron plate w/ brass accent.
    const coinText = `${player.gold}`;
    ctx.font = `bold ${uiSize(13)}px ${FONT_MONO}`;
    const coinW = Math.max(56, ctx.measureText(`◈${coinText}`).width + 22);
    const coinX = CANVAS_WIDTH - coinW - 12;
    drawIronPlate(ctx, coinX, 22, coinW, 30, { rivets: false, glow: IRON_PALETTE.brass });
    r.drawText('◈', coinX + 10, 37, {
      size: uiSize(13), baseline: 'middle', family: FONT_DISPLAY, color: IRON_PALETTE.brass
    });
    r.drawText(coinText, coinX + coinW - 10, 37, {
      size: uiSize(13), bold: true, align: 'right', baseline: 'middle',
      family: FONT_MONO, color: IRON_PALETTE.brass
    });
  }

  _renderTabs(r, player) {
    const g = this._tabsGeometry();
    const ctx = r.ctx;
    for (let i = 0; i < TABS.length; i++) {
      const x = g.baseX + i * g.tabW;
      const active = TABS[i].id === this.activeTab;
      drawIronPlate(ctx, x + 2, g.y, g.tabW - 4, TAB_H, {
        pressed: active,
        glow: active ? IRON_PALETTE.brass : null,
        rivets: false
      });
      ctx.save();
      ctx.font = `bold ${uiSize(11)}px ${FONT_DISPLAY}`;
      ctx.fillStyle = active ? IRON_PALETTE.brass : IRON_PALETTE.boneDim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawSpacedText(ctx, TABS[i].label.toUpperCase(),
        x + g.tabW / 2, g.y + TAB_H / 2, 2);
      ctx.restore();
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
    const ctx = r.ctx;
    const view = this._filteredView(player);
    const grid = this._gridGeometry();
    const maxSlots = this.activeTab === 'all'
      ? player.inventory.size
      : Math.max(view.length, COLS);
    for (let i = 0; i < Math.max(view.length, maxSlots); i++) {
      const cx = grid.startX + (i % COLS) * (SLOT_SIZE + SLOT_PADDING);
      const cy = grid.startY + Math.floor(i / COLS) * (SLOT_SIZE + SLOT_PADDING);
      const entry = view[i];
      const sel = i === this.selectedFilteredIdx;
      // Iron recessed slot with rarity-coloured border (or brass when selected).
      drawIronSlot(ctx, cx, cy, SLOT_SIZE, SLOT_SIZE, {
        selected: sel,
        rarity: entry?.item?.rarity,
        empty: !entry?.item
      });
      // Slot index badge top-left.
      if (entry && this.activeTab === 'all') {
        r.drawText(String(entry.slotIndex + 1), cx + 8, cy + 6,
          { size: uiSize(10), family: FONT_MONO, color: IRON_PALETTE.brass });
      }
      if (entry?.item) {
        const pad = 14;
        const icon = SLOT_SIZE - pad * 2;
        r.sprites.draw(entry.item.spriteKey, r.ctx, cx + pad, cy + pad, { size: icon });
        // Equipped badge.
        const isEq = entry.item === player.weapon || entry.item === player.armor
                  || entry.item === player.helm   || entry.item === player.legs
                  || entry.item === player.necklace || entry.item === player.ring;
        if (isEq) {
          r.drawRect(cx + SLOT_SIZE - 18, cy + 6, 14, 14, IRON_PALETTE.brass);
          r.drawStrokedRect(cx + SLOT_SIZE - 18, cy + 6, 14, 14, IRON_PALETTE.ink, 1);
          r.drawText('E', cx + SLOT_SIZE - 11, cy + 13, {
            size: uiSize(9), bold: true, align: 'center', baseline: 'middle',
            family: FONT_MONO, color: IRON_PALETTE.ink
          });
        }
        // Stack count.
        if (entry.item.stackable && entry.item.count > 1) {
          r.drawText(`×${entry.item.count}`, cx + SLOT_SIZE - 8, cy + SLOT_SIZE - 8,
            { size: uiSize(11), bold: true, align: 'right', baseline: 'bottom',
              family: FONT_MONO, color: IRON_PALETTE.bone });
        }
      }
    }
  }

  _renderDetailCard(r, player) {
    const ctx = r.ctx;
    const sel = this._selectedItem(player);
    const buttons = this._buttonLayout();
    const cardY = buttons[0].y - DETAIL_H - 8;
    const cardX = 12;
    const cardW = CANVAS_WIDTH - 24;
    drawInsetCard(ctx, cardX, cardY, cardW, DETAIL_H, {
      borderColor: sel ? ironRarity(sel.rarity) : IRON_PALETTE.plate2
    });

    if (!sel) {
      r.drawText('— no item selected —', CANVAS_WIDTH / 2, cardY + DETAIL_H / 2,
        { size: uiSize(13), italic: true, align: 'center', baseline: 'middle',
          family: FONT_BODY, color: IRON_PALETTE.boneDim });
      return;
    }

    const col = ironRarity(sel.rarity);
    // Icon recess on the left (matches mock — square with rarity border + glow).
    const iconSize = DETAIL_H - 28;
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
      const loreH = DETAIL_H - (loreY - cardY) - 10;
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
    const useLabel = !sel ? 'USE'
      : sel.slot ? (isEquipped ? 'UNEQUIP' : 'EQUIP')
      : 'USE';
    const items = [
      { text: useLabel, enabled: !!sel, accent: sel ? IRON_PALETTE.ember : null },
      { text: 'DROP',   enabled: !!sel },
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

function rarityColor(r) {
  switch (r) {
    case 'uncommon': return COLOR.itemUncommon;
    case 'rare':     return COLOR.itemRare;
    case 'epic':     return COLOR.itemEpic;
    default:         return COLOR.itemCommon;
  }
}

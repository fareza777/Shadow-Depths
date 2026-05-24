/**
 * InventoryUI — full-canvas modal: 3×3 slot grid + tooltip + big action
 * buttons (USE/EQUIP, DROP, CLOSE).
 *
 * Mobile UX:
 *   - Tap any slot → SELECT (highlight + show tooltip below). No use yet.
 *   - Tap the big USE button → consume / equip the selected item.
 *   - Tap CLOSE → dismiss.
 *
 * That two-step is intentional. Single-tap-to-use eats valuable items by
 * accident. Two big buttons separated from the slot grid prevent that.
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT, IS_LANDSCAPE } from '../config/constants.js';

// Orientation-aware geometry. Landscape uses smaller slots and a tighter
// header so the full inventory grid + tooltip + skill list + action row
// fit inside a 480-tall canvas without overlap.
const SLOT_SIZE    = IS_LANDSCAPE ? 60 : 90;
const SLOT_PADDING = IS_LANDSCAPE ? 8  : 10;
const COLS = 3;
const GRID_Y       = IS_LANDSCAPE ? 84 : 100;

const BTN_H        = IS_LANDSCAPE ? 40 : 56;
const BTN_GAP      = 8;
const BTN_PAD      = 12;
const BOTTOM_RESERVED = IS_LANDSCAPE ? 16 : 96;

export class InventoryUI {
  /** @param {{ bus: object }} deps */
  constructor({ bus }) {
    this.bus = bus;
    this.open = false;
    this.selectedSlot = 0;
  }

  toggle() {
    this.open = !this.open;
    if (this.open) this.selectedSlot = 0;
  }
  show() { this.open = true; this.selectedSlot = 0; }
  hide() { this.open = false; }

  /**
   * @param {import('../entities/Player.js').Player} player
   * @param {{ type: string, dx?: number, dy?: number, index?: number }} input
   */
  handleInput(player, input) {
    if (!this.open) return false;
    const total = player.inventory.size;
    switch (input.type) {
      case 'move': {
        const dx = input.dx || 0, dy = input.dy || 0;
        let s = this.selectedSlot + dx + dy * COLS;
        if (s < 0) s += total;
        if (s >= total) s -= total;
        this.selectedSlot = s;
        return true;
      }
      case 'confirm':
      case 'pickup':
        this._activateSelected(player);
        return true;
      case 'drop':
        this._dropSelected();
        return true;
      case 'inventory':
      case 'escape':
        this.hide();
        return true;
      case 'useSlot':
        if (typeof input.index === 'number') {
          this.selectedSlot = input.index;
          this._activateSelected(player);
        }
        return true;
      default:
        return true; // modal swallows everything else
    }
  }

  /**
   * Canvas tap. Returns true if consumed.
   */
  handleCanvasTap(canvasX, canvasY, player) {
    if (!this.open) return false;

    // Action buttons first (they sit at the bottom).
    const btnIdx = this._hitTestButtons(canvasX, canvasY);
    if (btnIdx >= 0) {
      if (btnIdx === 0) this._activateSelected(player);
      else if (btnIdx === 1) this._dropSelected();
      else if (btnIdx === 2) this.hide();
      return true;
    }

    // Slot grid.
    const grid = this._gridGeometry();
    for (let i = 0; i < player.inventory.size; i++) {
      const cx = grid.startX + (i % COLS) * (SLOT_SIZE + SLOT_PADDING);
      const cy = grid.startY + Math.floor(i / COLS) * (SLOT_SIZE + SLOT_PADDING);
      if (canvasX >= cx && canvasX <= cx + SLOT_SIZE &&
          canvasY >= cy && canvasY <= cy + SLOT_SIZE) {
        this.selectedSlot = i;
        return true;
      }
    }
    return true; // taps elsewhere don't close — must use CLOSE button
  }

  _activateSelected(player) {
    const item = player.inventory.getSlot(this.selectedSlot);
    if (!item) return;
    if (item.slot) this.bus.emit('command:equipSlot', { index: this.selectedSlot });
    else this.bus.emit('command:useSlot', { index: this.selectedSlot });
  }
  _dropSelected() {
    this.bus.emit('command:dropSlot', { index: this.selectedSlot });
  }

  _gridGeometry() {
    const totalW = COLS * SLOT_SIZE + (COLS - 1) * SLOT_PADDING;
    return {
      startX: (CANVAS_WIDTH - totalW) / 2,
      startY: GRID_Y,
      totalW
    };
  }

  _hitTestButtons(x, y) {
    const layout = this._buttonLayout();
    for (let i = 0; i < layout.length; i++) {
      const b = layout[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
    }
    return -1;
  }

  /** Three buttons stretched across the bottom. */
  _buttonLayout() {
    const count = 3;
    const totalW = CANVAS_WIDTH - BTN_PAD * 2;
    const w = (totalW - BTN_GAP * (count - 1)) / count;
    const y = CANVAS_HEIGHT - BTN_H - BTN_PAD - BOTTOM_RESERVED;
    return [
      { x: BTN_PAD,                          y, w, h: BTN_H, key: 'use' },
      { x: BTN_PAD + (w + BTN_GAP),          y, w, h: BTN_H, key: 'drop' },
      { x: BTN_PAD + 2 * (w + BTN_GAP),      y, w, h: BTN_H, key: 'close' }
    ];
  }

  // --- render --------------------------------------------------------
  render(renderer, player) {
    if (!this.open) return;
    renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(0,0,0,0.88)');

    renderer.drawText('INVENTORY', CANVAS_WIDTH / 2, 22,
      { size: 18, bold: true, align: 'center' });
    renderer.drawText(`◈ ${player.gold}    Lv ${player.level}`,
      CANVAS_WIDTH / 2, 44, { size: 11, align: 'center', color: COLOR.textXP });
    // All 4 equipment slots on two compact lines.
    renderer.drawText(`Wpn: ${player.weapon?.name || '—'}`,
      8, 62, { size: 10, color: COLOR.textMuted });
    renderer.drawText(`Arm: ${player.armor?.name || '—'}`,
      CANVAS_WIDTH - 8, 62, { size: 10, color: COLOR.textMuted, align: 'right' });
    renderer.drawText(`Hlm: ${player.helm?.name || '—'}`,
      8, 78, { size: 10, color: COLOR.textMuted });
    renderer.drawText(`Rng: ${player.ring?.name || '—'}`,
      CANVAS_WIDTH - 8, 78, { size: 10, color: COLOR.textMuted, align: 'right' });

    // Slot grid.
    const grid = this._gridGeometry();
    for (let i = 0; i < player.inventory.size; i++) {
      const cx = grid.startX + (i % COLS) * (SLOT_SIZE + SLOT_PADDING);
      const cy = grid.startY + Math.floor(i / COLS) * (SLOT_SIZE + SLOT_PADDING);
      const sel = i === this.selectedSlot;
      renderer.drawRect(cx, cy, SLOT_SIZE, SLOT_SIZE, '#1a1820');
      renderer.drawStrokedRect(cx, cy, SLOT_SIZE, SLOT_SIZE,
        sel ? '#d6c87a' : '#3a3340', sel ? 3 : 1);
      renderer.drawText(String(i + 1), cx + 4, cy + 2,
        { size: 10, color: COLOR.textMuted });
      const item = player.inventory.getSlot(i);
      if (item) {
        renderer.sprites.draw(item.spriteKey, renderer.ctx,
          cx + 18, cy + 18, { size: SLOT_SIZE - 36 });
        if (item.stackable && item.count > 1) {
          renderer.drawText(`×${item.count}`, cx + SLOT_SIZE - 6, cy + SLOT_SIZE - 6,
            { size: 12, bold: true, align: 'right', baseline: 'bottom' });
        }
      }
    }

    // Tooltip area.
    const sel = player.inventory.getSlot(this.selectedSlot);
    const tipY = grid.startY + Math.ceil(player.inventory.size / COLS) * (SLOT_SIZE + SLOT_PADDING) + 16;
    if (sel) {
      renderer.drawText(sel.name, CANVAS_WIDTH / 2, tipY,
        { size: IS_LANDSCAPE ? 14 : 16, bold: true, align: 'center' });
      renderer.drawText(this._statLine(sel), CANVAS_WIDTH / 2, tipY + 20,
        { size: 10, align: 'center', color: COLOR.textMuted });
      renderer.drawText(`"${sel.lore}"`, CANVAS_WIDTH / 2, tipY + 36,
        { size: 10, align: 'center', color: COLOR.textMuted });
    } else {
      renderer.drawText('— empty slot —', CANVAS_WIDTH / 2, tipY,
        { size: 12, align: 'center', color: COLOR.textMuted });
    }

    // Skill list — visible to the player so they remember what they have.
    // Sits between the tooltip and the action button row.
    if (player.skills && player.skills.length > 0) {
      const buttons = this._buttonLayout();
      const skillY = Math.min(tipY + 60, buttons[0].y - 24);
      renderer.drawText(
        `SKILLS: ${player.skills.map((s) => s.replace(/_/g, ' ')).join('  ·  ')}`,
        CANVAS_WIDTH / 2, skillY,
        { size: 10, align: 'center', color: '#a0d0ff' }
      );
    }

    // Action buttons.
    const buttons = this._buttonLayout();
    const labels = this._buttonLabels(sel);
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      const enabled = labels[i].enabled;
      renderer.drawRect(b.x, b.y, b.w, b.h, enabled ? '#2a2438' : '#16141c');
      renderer.drawStrokedRect(b.x, b.y, b.w, b.h, enabled ? '#d6c87a' : '#3a3340', enabled ? 2 : 1);
      renderer.drawText(labels[i].text, b.x + b.w / 2, b.y + b.h / 2,
        { size: 14, bold: true, align: 'center', baseline: 'middle',
          color: enabled ? COLOR.textPrimary : COLOR.textMuted });
    }
  }

  _buttonLabels(selectedItem) {
    const enabled = !!selectedItem;
    const useLabel = selectedItem?.slot ? 'EQUIP' : 'USE';
    return [
      { text: useLabel, enabled },
      { text: 'DROP',   enabled },
      { text: 'CLOSE',  enabled: true }
    ];
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
    if (item.onHit?.[0]?.type === 'lifesteal') parts.push(`Lifesteal ${Math.round(item.onHit[0].value * 100)}%`);
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

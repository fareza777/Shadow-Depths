/**
 * InventoryUI — full-canvas modal overlay shown when the player opens the
 * inventory. Renders the 9 slots in a 3×3 grid with selection + tooltip.
 *
 * State (open + selectedSlot) is local to the UI. The actual inventory
 * lives on the Player; this class just visualizes it and routes commands
 * (use/equip/drop) through the bus.
 */
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants.js';

export class InventoryUI {
  /**
   * @param {{ bus:object }} deps
   */
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
   * @param {{ type:string, dx?:number, dy?:number }} input  semantic input
   */
  handleInput(player, input) {
    if (!this.open) return false;
    const cols = 3, total = player.inventory.size;
    switch (input.type) {
      case 'move': {
        const dx = input.dx || 0, dy = input.dy || 0;
        let s = this.selectedSlot + dx + dy * cols;
        if (s < 0) s += total;
        if (s >= total) s -= total;
        this.selectedSlot = s;
        return true;
      }
      case 'confirm':
      case 'pickup': {
        const item = player.inventory.getSlot(this.selectedSlot);
        if (!item) return true;
        if (item.slot) this.bus.emit('command:equipSlot', { index: this.selectedSlot });
        else this.bus.emit('command:useSlot', { index: this.selectedSlot });
        return true;
      }
      case 'drop': {
        this.bus.emit('command:dropSlot', { index: this.selectedSlot });
        return true;
      }
      case 'inventory':
      case 'escape':
        this.hide();
        return true;
      case 'useSlot':
        if (typeof input.index === 'number') {
          const item = player.inventory.getSlot(input.index);
          if (item && item.slot) this.bus.emit('command:equipSlot', { index: input.index });
          else this.bus.emit('command:useSlot', { index: input.index });
        }
        return true;
      default:
        // Inventory modal is INPUT-MODAL: eat everything except what we
        // explicitly route, so e.g. PICK/DOWN buttons don't bleed through.
        return true;
    }
  }

  /**
   * Touch / mouse tap on the canvas while the modal is open. Mobile players
   * have no keyboard hotkeys, so tap-to-use is the primary inventory verb.
   * Returns true if the tap was consumed.
   */
  handleCanvasTap(canvasX, canvasY, player) {
    if (!this.open) return false;
    const slotSize = 80, padding = 8, cols = 3;
    const totalW = cols * slotSize + (cols - 1) * padding;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const startY = 80;
    for (let i = 0; i < player.inventory.size; i++) {
      const cx = startX + (i % cols) * (slotSize + padding);
      const cy = startY + Math.floor(i / cols) * (slotSize + padding);
      if (canvasX >= cx && canvasX <= cx + slotSize &&
          canvasY >= cy && canvasY <= cy + slotSize) {
        // First tap selects, second tap on the SAME slot activates — gives
        // the player a chance to read the tooltip before committing.
        if (this.selectedSlot === i) {
          const item = player.inventory.getSlot(i);
          if (!item) return true;
          if (item.slot) this.bus.emit('command:equipSlot', { index: i });
          else this.bus.emit('command:useSlot', { index: i });
        } else {
          this.selectedSlot = i;
        }
        return true;
      }
    }
    // Tap outside grid closes the modal.
    this.hide();
    return true;
  }

  render(renderer, player) {
    if (!this.open) return;
    // Translucent backdrop.
    renderer.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 'rgba(0,0,0,0.78)');

    const slotSize = 80, padding = 8, cols = 3;
    const totalW = cols * slotSize + (cols - 1) * padding;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const startY = 80;

    renderer.drawText('INVENTORY', CANVAS_WIDTH / 2, 30, { size: 18, bold: true, align: 'center' });
    renderer.drawText(`gold ${player.gold}    weapon ${player.weapon?.name || '—'}    armor ${player.armor?.name || '—'}`,
      CANVAS_WIDTH / 2, 56, { size: 11, align: 'center', color: COLOR.textMuted });

    for (let i = 0; i < player.inventory.size; i++) {
      const cx = startX + (i % cols) * (slotSize + padding);
      const cy = startY + Math.floor(i / cols) * (slotSize + padding);
      const selected = i === this.selectedSlot;
      renderer.drawRect(cx, cy, slotSize, slotSize, '#1a1820');
      renderer.drawStrokedRect(cx, cy, slotSize, slotSize, selected ? '#d6c87a' : '#3a3340', selected ? 2 : 1);
      renderer.drawText(String(i + 1), cx + 4, cy + 2, { size: 10, color: COLOR.textMuted });
      const item = player.inventory.getSlot(i);
      if (item) {
        renderer.sprites.draw(item.spriteKey, renderer.ctx, cx + 16, cy + 16, { size: slotSize - 32 });
        if (item.stackable && item.count > 1) {
          renderer.drawText(`×${item.count}`, cx + slotSize - 22, cy + slotSize - 14, { size: 11, bold: true });
        }
      }
    }

    // Tooltip for selected.
    const sel = player.inventory.getSlot(this.selectedSlot);
    const tipY = startY + Math.ceil(player.inventory.size / cols) * (slotSize + padding) + 12;
    if (sel) {
      renderer.drawText(sel.name, CANVAS_WIDTH / 2, tipY, { size: 14, bold: true, align: 'center' });
      renderer.drawText(this._statLine(sel), CANVAS_WIDTH / 2, tipY + 20, { size: 11, align: 'center', color: COLOR.textMuted });
      renderer.drawText(`"${sel.lore}"`, CANVAS_WIDTH / 2, tipY + 36, { size: 11, align: 'center', color: COLOR.textMuted });
    } else {
      renderer.drawText('— empty —', CANVAS_WIDTH / 2, tipY, { size: 12, align: 'center', color: COLOR.textMuted });
    }
    renderer.drawText('Enter use/equip    D drop    I close',
      CANVAS_WIDTH / 2, CANVAS_HEIGHT - 24, { size: 11, align: 'center', color: COLOR.textMuted });
  }

  _statLine(item) {
    const parts = [];
    if (item.stats?.atk)   parts.push(`+${item.stats.atk} ATK`);
    if (item.stats?.def)   parts.push(`+${item.stats.def} DEF`);
    if (item.stats?.dex)   parts.push(`${item.stats.dex >= 0 ? '+' : ''}${item.stats.dex} DEX`);
    if (item.stats?.critBonus) parts.push(`+${Math.round(item.stats.critBonus * 100)}% CRIT`);
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

/**
 * Equipment — helper module for the equip/unequip flow.
 *
 * Player owns the actual `weapon`/`armor` references (so the Player class
 * stays the single source of truth for stat queries). This module just
 * orchestrates the inventory <-> player handshake:
 *
 *   1. Take the item out of the inventory slot.
 *   2. Player.equip() swaps slots, returns the previously-equipped item.
 *   3. Put the previous item back into the freed inventory slot.
 *
 * Items without a `slot` field cannot be equipped (no-op + warning).
 */
import { LOG } from '../config/constants.js';

export const Equipment = {
  /**
   * @param {import('../entities/Player.js').Player} player
   * @param {import('./Inventory.js').Inventory} inventory
   * @param {number} slotIndex
   * @returns {{ ok:boolean, equipped?:object, swapped?:object, reason?:string }}
   */
  equipFromSlot(player, inventory, slotIndex) {
    const item = inventory.getSlot(slotIndex);
    if (!item) return { ok: false, reason: 'empty slot' };
    if (!item.slot) {
      console.warn(LOG.ITEM, `cannot equip "${item.id}" — no slot`);
      return { ok: false, reason: 'not equipment' };
    }
    inventory.takeAll(slotIndex);
    const swapped = player.equip(item);
    if (swapped) {
      // Put the previously-equipped item back into the freed slot.
      inventory.putAt(slotIndex, swapped);
    }
    return { ok: true, equipped: item, swapped };
  },

  /**
   * Unequip the item in the given slot. Returns it to inventory if there's
   * room, else fails (no auto-drop in v0.1; we ask the player).
   *
   * @param {'weapon'|'armor'|'helm'|'legs'|'necklace'|'ring'} slot
   */
  unequip(player, inventory, slot) {
    const current = slot === 'weapon' ? player.weapon
                  : slot === 'armor'  ? player.armor
                  : slot === 'helm'   ? player.helm
                  : slot === 'legs'   ? player.legs
                  : slot === 'necklace' ? player.necklace
                  : slot === 'ring'   ? player.ring
                  : null;
    if (!current) return { ok: false, reason: 'nothing equipped' };
    if (inventory.isFull()) return { ok: false, reason: 'inventory full' };

    // Reverse the stat side-effects that equip() applied.
    if (current.stats?.dex) player.stats.dex -= current.stats.dex;
    if (current.stats?.hpMaxBonus) {
      player.stats.hpMax = Math.max(1, player.stats.hpMax - current.stats.hpMaxBonus);
      player.stats.hp = Math.min(player.stats.hp, player.stats.hpMax);
    }
    if (slot === 'weapon') player.weapon = null;
    else if (slot === 'armor') player.armor = null;
    else if (slot === 'helm') player.helm = null;
    else if (slot === 'legs') player.legs = null;
    else if (slot === 'necklace') player.necklace = null;
    else if (slot === 'ring') player.ring = null;
    inventory.add(current);
    return { ok: true, unequipped: current };
  }
};

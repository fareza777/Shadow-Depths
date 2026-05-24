/**
 * Player — extends Entity with progression (xp/level), gold, and weapon/armor
 * slot references. The Inventory class (Part 3) is held here by composition so
 * UI can render it directly.
 *
 * Weapon and armor are intentionally NOT pulled into stats; CombatSystem reads
 * `player.weapon?.stats.atk` etc. at damage-resolution time. This keeps
 * equip/unequip a one-line operation and avoids stat-recalculation bugs.
 */
import { Entity } from './Entity.js';

export class Player extends Entity {
  /**
   * @param {object} balance merged balance config
   * @param {{ x:number, y:number }} pos
   * @param {import('../items/Inventory.js').Inventory} inventory
   */
  constructor(balance, pos, inventory) {
    const p = balance.player;
    super({
      id: 'player',
      kind: 'player',
      x: pos.x,
      y: pos.y,
      stats: { hp: p.startHP, hpMax: p.startHP, atk: p.startATK, def: p.startDEF, dex: p.startDEX }
    });
    this.balance = balance;
    this.gold = p.startGold;
    this.xp = 0;
    this.level = 1;
    this.inventory = inventory;
    /** @type {object|null} item instance currently equipped in weapon slot */
    this.weapon = null;
    /** @type {object|null} */
    this.armor = null;

    // Run-tracking stats (used by Game Over screen + score formula).
    this.runStats = {
      enemiesDefeated: 0,
      itemsUsed: 0,
      goldCollected: 0,
      xpGained: 0,
      turnsUsed: 0,
      floorsCleared: 0,
      perfectFloors: 0,
      killedBy: null
    };

    /** Effective revive charm uses remaining this run. */
    this.reviveCharges = 0;
  }

  // --- progression ----------------------------------------------------
  xpToNext() {
    const { xpBase, xpExponent } = this.balance.progression;
    return Math.floor(xpBase * Math.pow(this.level, xpExponent));
  }

  /**
   * Grant XP and apply any resulting level-ups.
   * @returns {number} number of levels gained
   */
  gainXP(amount) {
    if (this.isDead || amount <= 0) return 0;
    this.xp += amount;
    this.runStats.xpGained += amount;
    let gained = 0;
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this._levelUp();
      gained++;
    }
    return gained;
  }

  /** Drain XP (Shadow Wraith). Caps at 0; never reduces level. */
  drainXP(amount) {
    this.xp = Math.max(0, this.xp - amount);
  }

  _levelUp() {
    const p = this.balance.progression;
    this.level += 1;
    this.stats.hpMax += p.hpPerLevel;
    this.stats.atk += p.atkPerLevel;
    this.stats.def += p.defPerLevel;
    const healAmount = Math.floor(this.stats.hp * p.healPctPerLevel);
    this.heal(healAmount);
    if (this.level % p.dexEveryNLevels === 0) {
      this.stats.dex += p.dexPerTier;
    }
  }

  // --- equipment ------------------------------------------------------
  /**
   * Equip an item, swapping anything already in that slot back into inventory.
   * @returns {object|null} the displaced item, or null
   */
  equip(item) {
    if (!item || !item.slot) return null;
    const slot = item.slot;
    const prev = slot === 'weapon' ? this.weapon : (slot === 'armor' ? this.armor : null);
    if (slot === 'weapon') this.weapon = item;
    else if (slot === 'armor') this.armor = item;
    else return null;
    // Static stat side-effects (e.g. Plated Mail -1 DEX) apply on equip.
    if (item.stats?.dex) this.stats.dex += item.stats.dex;
    if (prev) {
      if (prev.stats?.dex) this.stats.dex -= prev.stats.dex;
    }
    return prev;
  }

  /** Calculated values used by HUD + tooltips. */
  totalAtk() {
    return this.stats.atk + (this.weapon?.stats?.atk || 0) + this.modifierAtk();
  }
  totalDef() {
    return this.stats.def + (this.armor?.stats?.def || 0) + this.modifierDef();
  }
  totalDex() {
    // dex bonus from weapon (crit) is treated separately at combat time; here
    // we just return base dex (effects already applied at equip).
    return this.stats.dex;
  }
  critChance() {
    const c = this.balance.combat;
    const weaponBonus = this.weapon?.stats?.critBonus || 0;
    return Math.min(0.95, c.baseCritChance + this.stats.dex * c.critPerDex + weaponBonus);
  }

  /** Called by CombatSystem when this player kills an enemy. */
  recordKill(enemy) {
    this.runStats.enemiesDefeated += 1;
    this.gainXP(enemy.xpReward || 0);
    if (enemy.goldDrop) {
      const min = enemy.goldDrop[0] ?? 0;
      const max = enemy.goldDrop[1] ?? min;
      // Note: deterministic gold pick happens upstream so result is
      // reproducible; here we just credit a pre-rolled value if given.
      if (typeof enemy._rolledGold === 'number') {
        this.gold += enemy._rolledGold;
        this.runStats.goldCollected += enemy._rolledGold;
      } else {
        // Fallback if combat didn't pre-roll.
        const g = Math.floor((min + max) / 2);
        this.gold += g;
        this.runStats.goldCollected += g;
      }
    }
  }
}

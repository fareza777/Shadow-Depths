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
import { resolvePlayerSpriteKey } from '../rendering/playerSprites.js';

export class Player extends Entity {
  /**
   * @param {object} balance merged balance config
   * @param {{ x:number, y:number }} pos
   * @param {import('../items/Inventory.js').Inventory} inventory
   * @param {{ heroKind?:string, heroOverrides?:object }} [opts]
   */
  constructor(balance, pos, inventory, opts = {}) {
    const p = balance.player;
    const hero = opts.heroOverrides || null;
    // Hero-specific starting stat overrides (vigil, hollow, etc.).
    const baseAtk = hero?.atk ?? p.startATK;
    const baseDef = hero?.def ?? p.startDEF;
    const baseDex = hero?.dex ?? p.startDEX;
    const baseHp  = hero?.hp  ?? p.startHP;
    super({
      id: 'player',
      kind: 'player',
      x: pos.x,
      y: pos.y,
      stats: { hp: baseHp, hpMax: baseHp, atk: baseAtk, def: baseDef, dex: baseDex }
    });
    this.balance = balance;
    this.heroKind = opts.heroKind || 'vigil';
    // Personal torch override — pilgrim sees 8 tiles, reaver only 3.
    if (hero && Number.isFinite(hero.torchRadius)) {
      this.torchRadius = hero.torchRadius;
    }
    // Render swap — Renderer.drawEntities reads spriteKey.
    this.spriteKey = `hero_${this.heroKind}`;
    this.gold = p.startGold;
    this.xp = 0;
    this.level = 1;
    this.maxLevel = balance.progression.maxLevel || 99;
    this.inventory = inventory;
    /** @type {object|null} item instance currently equipped in weapon slot */
    this.weapon = null;
    /** @type {object|null} */
    this.armor = null;
    /** @type {object|null} headgear — separate slot from torso armor */
    this.helm = null;
    /** @type {object|null} greaves / boots — legwear defensive slot */
    this.legs = null;
    /** @type {object|null} necklace — second accessory slot */
    this.necklace = null;
    /** @type {object|null} accessory ring — small flexible stat bumps */
    this.ring = null;

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

    /** Skills acquired this run (id strings). Order = acquisition order. */
    this.skills = [];
    /** Combat / progression multipliers set by skills. */
    this.xpMultiplier     = 1;
    this.skillLifesteal   = 0;   // +fraction healed on every hit
    this.damageReduction  = 0;   // 0..1 fractional reduction on incoming damage
    this.skillRangeBonus  = 0;   // +tiles to ranged weapon range
    this.regenEveryNTurns = 0;   // 5 means heal 3 every 5 turns; 0 disables
    this.regenAmount      = 0;
    this._turnsSinceRegen = 0;
  }

  /**
   * Apply a skill chosen on level-up. Most skills are simple stat changes;
   * a few set runtime multipliers read by CombatSystem during resolution.
   * @param {string} id
   * @returns {boolean} true if the skill was recognized
   */
  applySkill(id) {
    if (this.skills.includes(id)) return false; // no duplicates this run
    this.skills.push(id);
    switch (id) {
      case 'hardened':
        this.stats.hpMax += 5;
        this.heal(5);
        return true;
      case 'sharpened':
        this.stats.atk += 1;
        return true;
      case 'tempered':
        this.stats.def += 1;
        return true;
      case 'quickened':
        this.stats.dex += 2;
        return true;
      case 'eager':
        if (this.inventory) {
          this.inventory.size += 1;
          this.inventory.slots.push(null);
        }
        return true;
      case 'studious':
        this.xpMultiplier += 0.25;
        return true;
      case 'bloodthirst':
        this.skillLifesteal += 0.10;
        return true;
      case 'stout':
        this.damageReduction = Math.min(0.6, this.damageReduction + 0.10);
        return true;
      case 'long_reach':
        this.skillRangeBonus += 1;
        return true;
      case 'second_wind':
        this.regenEveryNTurns = 5;
        this.regenAmount = 3;
        return true;
      default:
        return false;
    }
  }

  /**
   * Called once per player turn by GameScene. Handles passive skill effects
   * that need a regular tick (currently just Second Wind regen).
   */
  passiveTurnTick() {
    if (this.regenEveryNTurns > 0) {
      this._turnsSinceRegen += 1;
      if (this._turnsSinceRegen >= this.regenEveryNTurns) {
        this._turnsSinceRegen = 0;
        this.heal(this.regenAmount);
      }
    }
  }

  // --- progression ----------------------------------------------------
  xpToNext() {
    if (this.level >= this.maxLevel) return Infinity;
    const { xpBase, xpExponent } = this.balance.progression;
    return Math.floor(xpBase * Math.pow(this.level, xpExponent));
  }

  /**
   * Grant XP and apply any resulting level-ups.
   * Studious skill multiplies the incoming amount before bookkeeping.
   * @returns {number} number of levels gained
   */
  gainXP(amount) {
    if (this.isDead || amount <= 0) return 0;
    if (this.level >= this.maxLevel) return 0;
    const adjusted = Math.floor(amount * (this.xpMultiplier || 1));
    this.xp += adjusted;
    this.runStats.xpGained += adjusted;
    let gained = 0;
    while (this.level < this.maxLevel) {
      const need = this.xpToNext();
      if (!Number.isFinite(need) || need <= 0 || this.xp < need) break;
      this.xp -= need;
      this._levelUp();
      gained++;
      if (gained > 99) break;
    }
    if (this.level >= this.maxLevel) this.xp = 0;
    return gained;
  }

  /** Drain XP (Shadow Wraith). Caps at 0; never reduces level. */
  drainXP(amount) {
    this.xp = Math.max(0, this.xp - amount);
  }

  _levelUp() {
    if (this.level >= this.maxLevel) return;
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
   * Supports six slot kinds: weapon, armor, helm, legs, necklace, ring.
   * @returns {object|null} the displaced item, or null
   */
  equip(item) {
    if (!item || !item.slot) return null;
    const slot = item.slot;
    let prev = null;
    if      (slot === 'weapon') { prev = this.weapon; this.weapon = item; }
    else if (slot === 'armor')  { prev = this.armor;  this.armor  = item; }
    else if (slot === 'helm')   { prev = this.helm;   this.helm   = item; }
    else if (slot === 'legs')   { prev = this.legs;   this.legs   = item; }
    else if (slot === 'necklace') { prev = this.necklace; this.necklace = item; }
    else if (slot === 'ring')   { prev = this.ring;   this.ring   = item; }
    else return null;
    // Static stat side-effects (e.g. Plated Mail -1 DEX) apply on equip.
    if (item.stats?.dex) this.stats.dex += item.stats.dex;
    if (prev?.stats?.dex) this.stats.dex -= prev.stats.dex;
    // Rings can grant +max HP outright (e.g. Ring of Vigor). Apply delta.
    if (item.stats?.hpMaxBonus) {
      this.stats.hpMax += item.stats.hpMaxBonus;
      this.stats.hp += item.stats.hpMaxBonus;
    }
    if (prev?.stats?.hpMaxBonus) {
      this.stats.hpMax = Math.max(1, this.stats.hpMax - prev.stats.hpMaxBonus);
      this.stats.hp = Math.min(this.stats.hp, this.stats.hpMax);
    }
    return prev;
  }

  /** All equipment pieces as an array (filters nulls). */
  equippedPieces() {
    return [this.weapon, this.armor, this.helm, this.legs, this.necklace, this.ring].filter(Boolean);
  }

  /** Sprite key for dungeon / UI portrait (sword, bow, mace, etc.). */
  displaySpriteKey() {
    return resolvePlayerSpriteKey(this.weapon);
  }

  /** Calculated values used by HUD + tooltips. */
  totalAtk() {
    let atk = this.stats.atk + this.modifierAtk();
    for (const p of this.equippedPieces()) atk += (p.stats?.atk || 0);
    return atk;
  }
  totalDef() {
    let def = this.stats.def + this.modifierDef();
    for (const p of this.equippedPieces()) def += (p.stats?.def || 0);
    return def;
  }
  totalDex() {
    // dex bonus already folded into this.stats.dex at equip() time.
    return this.stats.dex;
  }
  critChance() {
    const c = this.balance.combat;
    let bonus = 0;
    for (const p of this.equippedPieces()) bonus += (p.stats?.critBonus || 0);
    return Math.min(0.95, c.baseCritChance + this.stats.dex * c.critPerDex + bonus);
  }

  /** Effective ranged attack range (weapon range + long_reach skill bonus). */
  effectiveRange() {
    const base = this.weapon?.stats?.attackRange || 1;
    if (base <= 1) return 1;
    return base + (this.skillRangeBonus || 0);
  }

  /**
   * Called by CombatSystem when this player kills an enemy.
   * @returns {number} number of levels gained from the resulting XP grant
   *   (so the combat system can emit `entity:leveledUp` — without this the
   *   skill picker never opened on kill-driven level-ups).
   */
  recordKill(enemy) {
    this.runStats.enemiesDefeated += 1;
    const levels = this.gainXP(enemy.xpReward || 0);
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
    return levels;
  }
}

import { syncFloorMicroEventLegacy } from '../gameplay/floorEvents.js';
import { serializeEventTiles, restoreEventTiles } from '../gameplay/floorEventRuntime.js';
import { computeSynergyMods, skillsById } from '../gameplay/skillSynergy.js';
import { perfMeter } from '../debug/PerfMeter.js';

/**
 * RunPersistence owns the active-run save/snapshot lifecycle for GameScene.
 *
 * It intentionally keeps a scene reference because restore needs existing
 * factories and enemy construction hooks, while GameScene keeps thin wrappers
 * for older call sites.
 */
export class RunPersistence {
  constructor(scene) {
    this.scene = scene;
    this._runSaveTimer = 0;
    this._runSaveIdle = 0;
    this._runSaveQueued = false;
  }

  saveRun({ immediate = false } = {}) {
    const scene = this.scene;
    if (!scene.save || !scene.player || !scene.floor || scene.player.isDead) return;
    const savedAt = Date.now();
    scene.state.setRun({
      seed: scene.seed,
      mode: scene.mode,
      floorIndex: scene.dungeon.currentIndex,
      canContinue: true,
      level: scene.player.level,
      hp: scene.player.stats.hp,
      savedAt
    });
    if (immediate) {
      this.flushRunSave(savedAt);
      return;
    }
    this.scheduleRunSave();
  }

  scheduleRunSave() {
    if (this._runSaveQueued) return;
    this._runSaveQueued = true;
    const scheduleIdle = () => {
      this._runSaveTimer = 0;
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        this._runSaveIdle = window.requestIdleCallback(() => {
          this._runSaveIdle = 0;
          this.flushRunSave();
        }, { timeout: 900 });
      } else {
        this._runSaveTimer = setTimeout(() => {
          this._runSaveTimer = 0;
          this.flushRunSave();
        }, 120);
      }
    };
    this._runSaveTimer = setTimeout(scheduleIdle, 260);
  }

  cancelPendingRunSave() {
    if (this._runSaveTimer) {
      clearTimeout(this._runSaveTimer);
      this._runSaveTimer = 0;
    }
    if (this._runSaveIdle && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(this._runSaveIdle);
      this._runSaveIdle = 0;
    }
    this._runSaveQueued = false;
  }

  flushRunSave(savedAt = Date.now()) {
    const scene = this.scene;
    this.cancelPendingRunSave();
    if (!scene.save || !scene.player || !scene.floor || scene.player.isDead || scene._runEnded) return;
    const snapshot = {
      version: 1,
      savedAt,
      seed: scene.seed,
      mode: scene.mode,
      heroKind: scene.heroKind,
      floorIndex: scene.dungeon.currentIndex,
      player: this.playerSnapshot(),
      floor: this.floorSnapshot(scene.floor)
    };
    perfMeter.measure('save', () => scene.save.saveRun(snapshot));
  }

  playerSnapshot() {
    const { player } = this.scene;
    const itemSnap = (item) => {
      if (!item) return null;
      const s = { id: item.id, count: item.count || 1 };
      if (item.def?.affixes) s.affixes = item.def.affixes;
      return s;
    };
    return {
      pos: { x: player.x, y: player.y },
      stats: { ...player.stats },
      gold: player.gold,
      xp: player.xp,
      level: player.level,
      inventorySize: player.inventory.size,
      inventory: player.inventory.toSnapshot(),
      equipment: {
        weapon: itemSnap(player.weapon),
        armor: itemSnap(player.armor),
        helm: itemSnap(player.helm),
        legs: itemSnap(player.legs),
        necklace: itemSnap(player.necklace),
        ring: itemSnap(player.ring)
      },
      runStats: { ...player.runStats },
      reviveCharges: player.reviveCharges,
      skills: [...player.skills],
      xpMultiplier: player.xpMultiplier,
      skillLifesteal: player.skillLifesteal,
      damageReduction: player.damageReduction,
      skillRangeBonus: player.skillRangeBonus,
      regenEveryNTurns: player.regenEveryNTurns,
      regenAmount: player.regenAmount,
      turnsSinceRegen: player._turnsSinceRegen,
      magicPower: player.magicPower,
      spellCooldown: player.spellCooldown,
      spellCooldownReduction: player.spellCooldownReduction,
      spellLifesteal: player.spellLifesteal,
      critSkillBonus: player.critSkillBonus,
      triggerCooldowns: { ...(player._triggerCooldowns || {}) },
      materials: { ...(player.materials || {}) },
      rangedFocus: player.rangedFocus,
      rangedFocusMax: player.rangedFocusMax,
      floorModifiers: player.floorModifiers
        ? { ...player.floorModifiers } : null,
      statusEffects: player.statusEffects.map((e) => ({ ...e }))
    };
  }

  floorSnapshot(floor) {
    const scene = this.scene;
    const items = [];
    for (const [key, stack] of floor.items.entries()) {
      const [x, y] = key.split(',').map(Number);
      items.push({
        x, y,
        stack: stack.map((item) => {
          const snap = { id: item.id, count: item.count || 1 };
          if (item.def?.affixes) snap.affixes = item.def.affixes;
          return snap;
        })
      });
    }
    const enemies = floor.enemies().map((e) => ({
      defId: e.defId,
      x: e.x,
      y: e.y,
      stats: { ...e.stats },
      statusEffects: e.statusEffects.map((s) => ({ ...s })),
      rolledGold: e._rolledGold || 0,
      behaviorState: e.behavior?._counter !== undefined ? { counter: e.behavior._counter } : null
    }));
    const explored = [];
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (floor.tiles[y][x].explored) explored.push([x, y]);
      }
    }
    return {
      index: floor.index,
      clearedWithoutDamage: floor.clearedWithoutDamage,
      items,
      enemies,
      explored,
      forgeOffers: scene._forgeOffers[floor.index] || null,
      forgeUsed: !!scene._forgeUsed[floor.index],
      microEvent: floor.microEvent ? { ...floor.microEvent } : null,
      microEvents: (floor.microEvents || []).map((e) => ({ ...e })),
      eventTiles: serializeEventTiles(floor)
    };
  }

  restorePlayerSnapshot(player, snap) {
    const scene = this.scene;
    player.x = snap.pos?.x ?? player.x;
    player.y = snap.pos?.y ?? player.y;
    player.stats = { ...player.stats, ...(snap.stats || {}) };
    player.gold = snap.gold || 0;
    player.xp = snap.xp || 0;
    player.level = snap.level || 1;
    player.runStats = { ...player.runStats, ...(snap.runStats || {}) };
    player.reviveCharges = snap.reviveCharges || 0;
    player.skills = Array.isArray(snap.skills) ? [...snap.skills] : [];
    // Rebuild emergent skill-tag synergies from the restored skill set.
    if (typeof player.setSynergyMods === 'function') {
      const pool = (scene.content?.skills?.skills) || [];
      player.setSynergyMods(computeSynergyMods(player.skills, skillsById(pool)).mods);
    }
    player.xpMultiplier = snap.xpMultiplier ?? 1;
    player.skillLifesteal = snap.skillLifesteal || 0;
    player.damageReduction = snap.damageReduction || 0;
    player.skillRangeBonus = snap.skillRangeBonus || 0;
    player.regenEveryNTurns = snap.regenEveryNTurns || 0;
    player.regenAmount = snap.regenAmount || 0;
    player._turnsSinceRegen = snap.turnsSinceRegen || 0;
    player.magicPower = snap.magicPower || 0;
    player.spellCooldown = snap.spellCooldown || 0;
    player.spellCooldownReduction = snap.spellCooldownReduction || 0;
    player.spellLifesteal = snap.spellLifesteal || 0;
    player.critSkillBonus = snap.critSkillBonus || 0;
    player._triggerCooldowns = { ...(snap.triggerCooldowns || {}) };
    player.materials = { ...(snap.materials || {}) };
    player.rangedFocusMax = snap.rangedFocusMax || player.rangedFocusMax || 3;
    player.rangedFocus = snap.rangedFocus ?? player.rangedFocusMax;
    player.floorModifiers = snap.floorModifiers
      ? { ...snap.floorModifiers }
      : { atkPct: 0, defPenalty: 0, torchBonus: 0, critBonus: 0 };
    player.statusEffects = Array.isArray(snap.statusEffects) ? snap.statusEffects.map((e) => ({ ...e })) : [];
    const make = (s) => (s?.id ? scene.itemFactory.fromSnapshot(s) : null);
    const eq = snap.equipment || {};
    player.weapon = make(eq.weapon);
    player.armor = make(eq.armor);
    player.helm = make(eq.helm);
    player.legs = make(eq.legs);
    player.necklace = make(eq.necklace);
    player.ring = make(eq.ring);
  }

  restoreFloorSnapshot(floor, snap = {}) {
    const scene = this.scene;
    floor.items = new Map();
    floor.clearedWithoutDamage = snap.clearedWithoutDamage !== false;
    floor.clearVisibility();
    if (snap.forgeOffers) scene._forgeOffers[floor.index] = snap.forgeOffers;
    if (snap.forgeUsed) scene._forgeUsed[floor.index] = true;
    if (snap.microEvents?.length) {
      floor.microEvents = snap.microEvents.map((e) => ({ ...e }));
    } else if (snap.microEvent) {
      floor.microEvents = [{ ...snap.microEvent }];
    }
    syncFloorMicroEventLegacy(floor);
    restoreEventTiles(floor, snap.eventTiles || []);
    for (const pair of snap.explored || []) {
      const [x, y] = pair;
      const t = floor.tileAt(x, y);
      if (t) t.explored = true;
    }
    for (const it of snap.items || []) {
      for (const itemSnap of it.stack || []) {
        const item = scene.itemFactory.fromSnapshot(itemSnap);
        if (item) floor.addItem(it.x, it.y, item);
      }
    }
    for (const enemySnap of snap.enemies || []) {
      const enemy = scene._createEnemy(enemySnap.defId, { x: enemySnap.x, y: enemySnap.y }, floor);
      if (!enemy) continue;
      enemy.stats = { ...enemy.stats, ...(enemySnap.stats || {}) };
      enemy.statusEffects = Array.isArray(enemySnap.statusEffects)
        ? enemySnap.statusEffects.map((e) => ({ ...e }))
        : [];
      enemy._rolledGold = enemySnap.rolledGold || 0;
      if (enemy.behavior && enemySnap.behaviorState?.counter !== undefined) {
        enemy.behavior._counter = enemySnap.behaviorState.counter;
      }
      enemy.isDead = enemy.stats.hp <= 0;
      if (!enemy.isDead) floor.addEntity(enemy);
    }
  }
}

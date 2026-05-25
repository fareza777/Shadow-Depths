/**
 * GameScene — in-game scene. Owns the turn engine + active dungeon.
 *
 * Lives in src/core/ because it's orchestration glue (it ties together
 * CombatSystem, Dungeon, Renderer, HUD) rather than UI or world data. The
 * brief lists scenes loosely; I picked core over a new src/scenes/ folder
 * to avoid expanding the mandated structure.
 *
 * Turn order (Section 7.1 of the brief):
 *   1. Player action validated + executed.
 *   2. Player status effects tick.
 *   3. Each enemy decides + acts (closest-first).
 *   4. Enemy status effects tick.
 *   5. Lighting recomputed; render next frame.
 *
 * Per-frame work is delegated to Renderer + ParticleSystem; this scene does
 * no per-tick simulation. Update() is empty by design.
 */
import { TILE, TILE_SIZE, LOG } from '../config/constants.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Inventory } from '../items/Inventory.js';
import { ItemFactory } from '../items/ItemFactory.js';
import { Equipment } from '../items/Equipment.js';
import { findQuickUseSlots } from '../items/quickUse.js';
import { Dungeon } from '../world/Dungeon.js';
import { Pathfinding } from '../world/Pathfinding.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { RNG } from './RNG.js';

import { ChaseBehavior } from '../entities/behaviors/ChaseBehavior.js';
import { RangedBehavior, hasLineOfSight } from '../entities/behaviors/RangedBehavior.js';
import { ErraticBehavior } from '../entities/behaviors/ErraticBehavior.js';
import { HeavyBehavior } from '../entities/behaviors/HeavyBehavior.js';
import { PhaseBehavior } from '../entities/behaviors/PhaseBehavior.js';

const BEHAVIORS = {
  chase: ChaseBehavior,
  ranged: RangedBehavior,
  erratic: ErraticBehavior,
  heavy: HeavyBehavior,
  phase: PhaseBehavior
};

export class GameScene {
  /**
   * @param {{
   *   bus:object, state:object, content:object, balance:object,
   *   hud:object, minimap:object, inventoryUI:object, lighting:object,
   *   seed?:number
   * }} deps
   */
  constructor(deps) {
    this.bus = deps.bus;
    this.state = deps.state;
    this.content = deps.content;
    this.balance = deps.balance;
    this.hud = deps.hud;
    this.minimap = deps.minimap;
    this.inventoryUI = deps.inventoryUI;
    this.skillPicker = deps.skillPicker || null;
    this.vigil = deps.vigilScreen || null;
    this.controls = deps.mobileControls || null;
    this.quickUse = deps.quickUseBar || null;
    this.pause = deps.pauseOverlay || null;
    this.lighting = deps.lighting;
    this.renderer = deps.renderer || null; // optional; used for tap→tile

    this.seed = deps.seed ?? RNG.newSeed();
    this.mode = deps.mode || 'normal'; // 'normal' | 'daily'
    this.rng = new RNG(this.seed, 'run');
    this.pathfinding = new Pathfinding();
    this.combat = new CombatSystem({
      bus: this.bus, balance: this.balance,
      rng: this.rng, pathfinding: this.pathfinding
    });

    this.itemFactory = new ItemFactory(this.content.items);
    this.dungeon = new Dungeon({
      balance: this.balance, rng: this.rng, content: this.content
    });

    this.player = null;
    this.floor = null;
    this._wireCommands();
    this._wireDeathCleanup();
  }

  // --- scene contract -------------------------------------------------
  enter(_opts) {
    const inv = new Inventory(this.balance.player.inventorySlots);
    const { floor, spawns } = this.dungeon.getOrGenerate(0);
    this.player = new Player(this.balance, spawns.player, inv);
    this.player.snapRender();
    floor.addEntity(this.player);

    this._spawnFloorEntities(floor, spawns);
    this._applyStarterLoadout();
    this._applyMetaUnlocks();

    this.floor = floor;
    this.lighting.compute(this.floor, this.player);
    this.state.setRun({ seed: this.seed, floorIndex: 0 });
    this.bus.emit('floor:entered', { index: 0, name: floor.definition.name });
  }

  exit() { /* no-op; state retained until next newRun() */ }

  update(_dt) { /* turn-based; no per-frame logic */ }

  render(renderer) {
    if (!this.floor || !this.player) return;
    // Cache renderer for tap→tile conversion in handleInput.
    if (!this.renderer) this.renderer = renderer;
    // Camera follows player; world draws use this offset internally.
    renderer.setCameraFor(this.player.renderX, this.player.renderY);

    renderer.drawFloor(this.floor, this.player);
    renderer.drawGroundItems(this.floor);
    renderer.drawTelegraphs(this.floor, this.player);
    const now = performance.now();
    const dt = this._lastRenderTime ? (now - this._lastRenderTime) / 1000 : 0;
    this._lastRenderTime = now;
    renderer.drawEntities(this.floor, dt, this.player);

    // HUD layers (drawn in screen space).
    this.hud.render(renderer, {
      player: this.player, floor: this.floor,
      floorIndex: this.dungeon.currentIndex,
      totalFloors: this.dungeon.totalFloors
    });
    // Control band: solid background + D-pad + action buttons. Minimap
    // paints inside the band's center cutout (see Minimap.js for offset).
    if (this.controls) this.controls.render(renderer);
    this.minimap.render(renderer, { floor: this.floor, player: this.player });
    if (this.quickUse) this.quickUse.render(renderer, this.player);
    // Inventory modal on top of HUD.
    this.inventoryUI.render(renderer, this.player);
    // Vigil character sheet sits above inventory and below skill picker.
    if (this.vigil) this.vigil.render(renderer, this.player);
    // Skill picker on top of EVERYTHING — it blocks all other input.
    if (this.skillPicker) this.skillPicker.render(renderer);
    if (this.pause) this.pause.render(renderer);
  }

  // --- input ----------------------------------------------------------
  handleInput(action) {
    if (!action || this.player.isDead) return;

    if (this.pause?.open) {
      if (action.type === 'pointer') {
        const idx = this.pause.hitTest(action.x, action.y);
        if (idx >= 0) {
          this.pause.handleInput({ type: 'tap', buttonIndex: idx });
        }
        return;
      }
      if (this.pause.handleInput(action)) return;
    }

    // Skill picker modal takes highest priority — it pops on level-up and
    // must resolve before any other input.
    if (this.skillPicker?.open) {
      if (action.type === 'escape') {
        this.skillPicker.hide();
        return;
      }
      if (action.type === 'pointer') {
        this.skillPicker.handleCanvasTap(action.x, action.y);
        return;
      }
      if (action.type === 'tapTile') return;
      if (this.skillPicker.handleInput(action)) return;
    }

    // Vigil (character) screen — full-canvas modal.
    if (this.vigil?.open) {
      if (action.type === 'pointer') {
        this.vigil.handleCanvasTap(action.x, action.y, this.player);
        return;
      }
      if (action.type === 'tapTile') return;
      if (this.vigil.handleInput(this.player, action)) return;
    }

    // Inventory modal — handle canvas taps first (mobile-critical), then
    // route every other semantic action through its handler. Both swallow.
    if (this.inventoryUI.open) {
      if (action.type === 'pointer') {
        this.inventoryUI.handleCanvasTap(action.x, action.y, this.player);
        return;
      }
      if (action.type === 'tapTile') return; // suppress tile interpretation
      if (this.inventoryUI.handleInput(this.player, action)) return;
    }

    switch (action.type) {
      case 'move':       return this._playerMove(action.dx, action.dy);
      case 'wait':       return this._endPlayerTurn(true);
      case 'pickup':     return this._playerPickup();
      case 'descend':    return this._playerDescend();
      case 'inventory':  return this.inventoryUI.toggle();
      case 'vigil':
        if (this.vigil) {
          if (this.vigil.open) this.vigil.hide();
          else {
            this.inventoryUI.hide();
            this.vigil.show();
          }
        }
        return;
      case 'menu':
        if (this.pause) this.pause.show();
        return;
      case 'minimap':    return this.minimap.toggle();
      case 'quickUse':   return this._playerQuickUse(action.index);
      case 'useSlot':    return this._playerUseSlot(action.index);
      case 'pointer': {
        // Canvas tap dispatch order:
        //   1. Control band buttons (D-pad / actions) — they're painted
        //      INSIDE the canvas now, so hit-tests are pixel-perfect.
        //   2. World viewport → tap-to-walk via Renderer.canvasToTile.
        //   3. HUD area taps fall through (no behavior).
        if (this.quickUse) {
          const quickHit = this.quickUse.hitTest(
            action.x, action.y, this.state.state.time, this.player?.inventory
          );
          if (typeof quickHit === 'number' && quickHit >= 0) {
            this._playerQuickUse(quickHit);
            return;
          }
          if (quickHit && typeof quickHit.type === 'string') {
            this.handleInput({ type: quickHit.type });
            return;
          }
        }
        if (this.controls && this.controls.handleTap(action.x, action.y, this.state.state.time)) return;
        if (!this.renderer) return;
        if (this._tryTapAttackAdjacent(action.x, action.y)) return;
        const tile = this.renderer.canvasToTile(action.x, action.y);
        if (!tile) return;
        return this._playerTapTile(tile.x, tile.y);
      }
      case 'tapTile':    return; // legacy; pointer is preferred
      case 'escape':
        if (this.inventoryUI.open) return this.inventoryUI.hide();
        if (this.vigil?.open) { this.vigil.hide(); return; }
        if (this.pause) { this.pause.toggle(); return; }
        return;
      default: break;
    }
  }

  /**
   * Subscribe to entity:died so dead enemies are removed from the floor
   * immediately. Without this they persisted in the spatial index and
   * blocked movement on their tile (the "invisible corpse" bug).
   */
  _wireDeathCleanup() {
    this.bus.on('entity:died', ({ entity }) => {
      if (!this.floor) return;
      if (entity?.kind === 'enemy') {
        this.floor.removeEntity(entity);
      }
    });
  }

  // --- player actions -------------------------------------------------
  _playerMove(dx, dy) {
    const nx = this.player.x + dx, ny = this.player.y + dy;
    const target = this.floor.entityAt(nx, ny);
    if (target && target.kind === 'enemy' && !target.isDead) {
      this._attackEnemyAt(nx, ny);
      return;
    }
    if (this.floor.isPassable(nx, ny)) {
      this.combat.execute({ type: 'move', to: { x: nx, y: ny } },
        this.player, { floor: this.floor, player: this.player });
      this._endPlayerTurn(true);
    }
  }

  _attackEnemyAt(tx, ty) {
    const ent = this.floor.entityAt(tx, ty);
    if (!ent || ent.kind !== 'enemy' || ent.isDead) return;
    this.combat.execute(
      { type: 'attack', target: { x: tx, y: ty } },
      this.player,
      { floor: this.floor, player: this.player }
    );
    this._endPlayerTurn(true);
  }

  /** Generous tap hit on adjacent foe (sprite larger than one tile). */
  _tryTapAttackAdjacent(canvasX, canvasY) {
    const adj = this._adjacentEnemy();
    if (!adj || !this.renderer) return false;
    const cam = this.renderer.camera;
    const cx = (adj.renderX + 0.5) * TILE_SIZE + cam.x;
    const cy = (adj.renderY + 0.5) * TILE_SIZE + cam.y;
    if (Math.hypot(canvasX - cx, canvasY - cy) <= TILE_SIZE * 0.62) {
      this._attackEnemyAt(adj.x, adj.y);
      return true;
    }
    return false;
  }

  _playerPickup() {
    const stack = this.floor.itemsAt(this.player.x, this.player.y);
    if (stack.length === 0) return;
    const item = stack[stack.length - 1];
    const { added, overflow } = this.player.inventory.add(item);
    if (!added || overflow > 0) {
      if (!added) { this.bus.emit('inventory:full'); return; }
      item.count = overflow; // leave the rest on the ground
    } else {
      this.floor.takeItemAt(this.player.x, this.player.y);
    }
    this.bus.emit('item:pickedUp', { item, by: this.player });
    this._endPlayerTurn(true);
  }

  _playerDescend() {
    const t = this.floor.tileAt(this.player.x, this.player.y);
    if (!t || t.type !== TILE.STAIRS_DOWN) return;
    // Floor cleared bookkeeping.
    this.player.runStats.floorsCleared += 1;
    if (this.floor.clearedWithoutDamage) this.player.runStats.perfectFloors += 1;

    const next = this.dungeon.descend();
    if (!next) {
      this._endRun(true);
      return;
    }
    // Move the player to the new floor.
    this.floor.removeEntity(this.player);
    const { floor, spawns } = next;
    this.player.x = spawns.player.x; this.player.y = spawns.player.y;
    this.player.snapRender();
    floor.addEntity(this.player);
    this._spawnFloorEntities(floor, spawns);
    this.floor = floor;
    this.pathfinding.invalidate();
    this.lighting.compute(this.floor, this.player);
    this.state.patch('run.floorIndex', this.dungeon.currentIndex);
    this.bus.emit('floor:entered', { index: this.dungeon.currentIndex, name: floor.definition.name });
  }

  /** Use quick bar slot 0–2 (first consumables / throwables in bag order). */
  _playerQuickUse(quickIndex) {
    const slots = findQuickUseSlots(this.player.inventory);
    const invIdx = slots[quickIndex];
    if (invIdx === undefined) return;
    this._playerUseSlot(invIdx);
  }

  _playerUseSlot(index) {
    const item = this.player.inventory.getSlot(index);
    if (!item) return;
    // Equip is a free action.
    if (item.slot) {
      const result = Equipment.equipFromSlot(this.player, this.player.inventory, index);
      if (result.ok) this.bus.emit('player:equipped', { item: result.equipped });
      return;
    }
    // Throwables need a target — for v0.1, auto-target the nearest visible enemy in range.
    let throwTarget = null;
    if (item.target === 'tile') {
      throwTarget = this._autoTarget(item.range || 4);
      if (!throwTarget) {
        this.bus.emit('inventory:noTarget');
        return;
      }
    }
    const used = this.combat.useItemSlot({
      player: this.player, floor: this.floor,
      inventory: this.player.inventory, throwTarget
    }, index);
    if (used) this._endPlayerTurn(true);
  }

  _playerTapTile(tx, ty) {
    const dxRaw = tx - this.player.x;
    const dyRaw = ty - this.player.y;
    const targetEnemy = this.floor.entityAt(tx, ty);
    const distToTarget = Math.abs(dxRaw) + Math.abs(dyRaw);

    if (targetEnemy && targetEnemy.kind === 'enemy' && distToTarget === 1) {
      this._attackEnemyAt(tx, ty);
      return;
    }

    if (dxRaw === 0 && dyRaw === 0) {
      const adj = this._adjacentEnemy();
      if (adj) {
        this._attackEnemyAt(adj.x, adj.y);
        return;
      }
      const stack = this.floor.itemsAt(tx, ty);
      if (stack.length > 0) this._playerPickup();
      else this._endPlayerTurn(true);
      return;
    }

    if (targetEnemy && targetEnemy.kind === 'enemy') {
      const range = this.player.effectiveRange();
      if (range > 1 && distToTarget <= range &&
          hasLineOfSight(this.floor, this.player, targetEnemy)) {
        this.combat.execute(
          { type: 'ranged', target: { x: tx, y: ty } },
          this.player,
          { floor: this.floor, player: this.player }
        );
        this._endPlayerTurn(true);
        return;
      }
    }

    // Cardinal tap-to-walk (4-directional, dominant-axis step).
    let dx = 0, dy = 0;
    if (Math.abs(dxRaw) >= Math.abs(dyRaw)) dx = Math.sign(dxRaw);
    else dy = Math.sign(dyRaw);
    this._playerMove(dx, dy);
  }

  /** @returns {import('../entities/Enemy.js').Enemy|null} */
  _adjacentEnemy() {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const ent = this.floor.entityAt(this.player.x + dx, this.player.y + dy);
      if (ent && ent.kind === 'enemy' && !ent.isDead) return ent;
    }
    return null;
  }

  // --- turn management -----------------------------------------------
  _endPlayerTurn(actionTaken) {
    if (!actionTaken) return;
    this.player.runStats.turnsUsed += 1;
    // Passive skill tick (Second Wind regen, future passives).
    if (typeof this.player.passiveTurnTick === 'function') this.player.passiveTurnTick();
    this.combat.tickEntity(this.player);
    if (this.player.isDead) { this._endRun(false); return; }
    this._runEnemyTurns();
    // CRITICAL: enemy turns can kill the player. Without this check the
    // GameOver scene never triggered and the player was stuck on a dead
    // body that couldn't input. Bug from v0.2.0 first playtest.
    if (this.player.isDead) { this._endRun(false); return; }
    this.pathfinding.invalidate();
    this.lighting.compute(this.floor, this.player);
    this._refreshEnemyIntents();

    if (this.player.stats.hp < this.player.stats.hpMax) this.floor.clearedWithoutDamage = false;
  }

  /** Show next-turn intent icons without re-running behavior AI (avoids Heavy counter drift). */
  _refreshEnemyIntents() {
    if (!this.floor || !this.player) return;
    for (const e of this.floor.enemies()) {
      if (e.isDead) continue;
      e.intent = this._peekEnemyIntent(e) || { type: 'wait' };
    }
  }

  _peekEnemyIntent(enemy) {
    const d = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
    if (d === 1) return { type: 'attack', target: { x: this.player.x, y: this.player.y } };
    const beh = enemy.behavior;
    if (beh?.actEveryNTurns && typeof beh._counter === 'number') {
      const next = beh._counter + 1;
      if (next < beh.actEveryNTurns) {
        return { type: 'wait', meta: { winding: true } };
      }
    }
    if (beh?.range && d <= beh.range && d >= (beh.minDistance ?? 0)) {
      return { type: 'ranged', target: { x: this.player.x, y: this.player.y } };
    }
    if (d <= 8) return { type: 'move' };
    return { type: 'wait' };
  }

  _runEnemyTurns() {
    const enemies = this.floor.enemies()
      .map((e) => ({ e, d: Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) }))
      .sort((a, b) => a.d - b.d)
      .map((wrap) => wrap.e);

    const ctx = {
      floor: this.floor,
      player: this.player,
      rng: this.combat.rng,
      pathfinding: this.pathfinding,
      turn: this.player.runStats.turnsUsed
    };

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const action = enemy.decide(ctx);
      this.combat.execute(action, enemy, ctx);
      this.combat.tickEntity(enemy);
      if (this.player.isDead) break;
    }
  }

  // --- spawning -------------------------------------------------------
  _spawnFloorEntities(floor, spawns) {
    // depthScale comes from the procedurally-built floor definition;
    // makes deeper floors actually threatening (HP & damage scale).
    const depthScale = floor.definition?.depthScale || 1;
    for (const s of spawns.enemies) {
      const def = this.content.enemies[s.defId];
      if (!def) { console.warn(LOG.ENTITY, `no enemy def "${s.defId}"`); continue; }
      const BehaviorCls = BEHAVIORS[def.behavior] || ChaseBehavior;
      const behavior = new BehaviorCls(def.behaviorParams);
      const enemy = new Enemy(def, behavior, { x: s.x, y: s.y }, depthScale);
      enemy.snapRender();
      floor.addEntity(enemy);
    }
    for (const s of spawns.items) {
      const item = this.itemFactory.create(s.defId, 1);
      if (item) floor.addItem(s.x, s.y, item);
    }
  }

  /** Every run begins with a basic dagger — no cleaver/bow unless shop unlocks. */
  _applyStarterLoadout() {
    const dagger = this.itemFactory.create('worn_dagger', 1);
    if (dagger) this.player.equip(dagger);
  }

  _applyMetaUnlocks() {
    const meta = this.state.state.meta;
    if (!meta) return;

    // Score-threshold unlocks (legacy v0.1 system).
    for (const id of meta.unlocks || []) {
      if (id === 'worn_dagger') {
        if (this.player.weapon?.id === 'worn_dagger' && this.player.weapon.stats) {
          this.player.weapon.stats.atk = (this.player.weapon.stats.atk || 1) + 1;
        }
      } else if (id === 'veterans_vigor') {
        this.player.stats.hpMax += 10;
        this.player.stats.hp += 10;
      } else if (id === 'lucky_charm') {
        const charm = this.itemFactory.create('revive_charm', 1);
        if (charm) this.player.inventory.add(charm);
      } else if (id === 'map_sense') {
        if (this.dungeon.currentIndex === 0) this.floor?.revealAll();
      }
    }

    // Shop-purchased upgrades (coin economy).
    const ups = meta.shopUpgrades || {};
    if (ups.start_hp) {
      const bonus = ups.start_hp * 5;
      this.player.stats.hpMax += bonus;
      this.player.stats.hp += bonus;
    }
    if (ups.start_atk) this.player.stats.atk += ups.start_atk;
    if (ups.start_def) this.player.stats.def += ups.start_def;
    if (ups.start_dex) this.player.stats.dex += ups.start_dex;
    if (ups.extra_slot) {
      for (let i = 0; i < ups.extra_slot; i++) {
        this.player.inventory.size += 1;
        this.player.inventory.slots.push(null);
      }
    }
    if (ups.start_potion) {
      const potion = this.itemFactory.create('health_potion', 1);
      if (potion) this.player.inventory.add(potion);
    }
    if (ups.start_bow) {
      const bow = this.itemFactory.create('shortbow', 1);
      if (bow) {
        const swap = this.player.equip(bow);
        if (swap) this.player.inventory.add(swap);
      }
    }
    if (ups.start_revive) {
      this.player.reviveCharges += ups.start_revive;
    }
    if (ups.scholar_start) {
      // Grant just enough XP to hit level 2 immediately.
      const need = this.player.xpToNext();
      this.player.gainXP(need);
    }
  }

  // --- targeting helper ----------------------------------------------
  _autoTarget(range) {
    let best = null, bestDist = Infinity;
    for (const e of this.floor.enemies()) {
      const t = this.floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      const d = Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y);
      if (d <= range && d < bestDist) { best = e; bestDist = d; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  // --- finalization --------------------------------------------------
  _endRun(victory) {
    const summary = {
      ...this.player.runStats,
      died: !victory,
      mode: this.mode,
      seed: this.seed
    };
    if (victory) this.bus.emit('run:victory', summary);
    else this.bus.emit('run:over', summary);
  }

  // --- commands from UI ----------------------------------------------
  _wireCommands() {
    this.bus.on('command:useSlot',  ({ index }) => { this._playerUseSlot(index); this.inventoryUI.hide(); });
    this.bus.on('command:equipSlot',({ index }) => { this._playerUseSlot(index); this.inventoryUI.hide(); });
    this.bus.on('command:dropSlot', ({ index }) => this._dropSlot(index));
    this.bus.on('command:unequip', ({ slot }) => this._unequipSlot(slot));
  }

  /**
   * Unequip a piece from the player and stash it back into the inventory.
   * Called from VigilScreen when user taps an UNEQUIP card button.
   */
  _unequipSlot(slot) {
    // Lazy import via dynamic — actually we already imported Equipment elsewhere.
    // Inline the logic to avoid circular import risk.
    const player = this.player;
    if (!player) return;
    const current = slot === 'weapon' ? player.weapon
                  : slot === 'armor'  ? player.armor
                  : slot === 'helm'   ? player.helm
                  : slot === 'legs'   ? player.legs
                  : slot === 'necklace' ? player.necklace
                  : slot === 'ring'   ? player.ring
                  : null;
    if (!current) return;
    if (player.inventory.isFull()) {
      this.bus.emit('inventory:full');
      return;
    }
    // Reverse stat side-effects.
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
    player.inventory.add(current);
    this.bus.emit('player:unequipped', { item: current, slot });
  }

  _dropSlot(index) {
    const item = this.player.inventory.takeAll(index);
    if (!item) return;
    this.floor.addItem(this.player.x, this.player.y, item);
    this.bus.emit('item:dropped', { item });
  }
}

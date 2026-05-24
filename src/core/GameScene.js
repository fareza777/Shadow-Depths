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
import { TILE, LOG } from '../config/constants.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Inventory } from '../items/Inventory.js';
import { ItemFactory } from '../items/ItemFactory.js';
import { Equipment } from '../items/Equipment.js';
import { Dungeon } from '../world/Dungeon.js';
import { Pathfinding } from '../world/Pathfinding.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { LightingSystem } from '../rendering/LightingSystem.js';
import { RNG } from './RNG.js';

import { ChaseBehavior } from '../entities/behaviors/ChaseBehavior.js';
import { RangedBehavior } from '../entities/behaviors/RangedBehavior.js';
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
    this.lighting = deps.lighting;
    this.renderer = deps.renderer || null; // optional; used for tap→tile

    this.seed = deps.seed ?? RNG.newSeed();
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

    renderer.drawFloor(this.floor);
    renderer.drawGroundItems(this.floor);
    const now = performance.now();
    const dt = this._lastRenderTime ? (now - this._lastRenderTime) / 1000 : 0;
    this._lastRenderTime = now;
    renderer.drawEntities(this.floor, dt);

    // HUD layers (drawn in screen space).
    this.hud.render(renderer, {
      player: this.player, floor: this.floor,
      floorIndex: this.dungeon.currentIndex,
      totalFloors: this.dungeon.totalFloors
    });
    this.minimap.render(renderer, { floor: this.floor, player: this.player });
    this.inventoryUI.render(renderer, this.player);
  }

  // --- input ----------------------------------------------------------
  handleInput(action) {
    if (!action || this.player.isDead) return;

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
      case 'minimap':    return this.minimap.toggle();
      case 'useSlot':    return this._playerUseSlot(action.index);
      case 'pointer': {
        // Canvas tap → tile (camera-offset aware via Renderer).
        if (!this.renderer) return;
        const tile = this.renderer.canvasToTile(action.x, action.y);
        return this._playerTapTile(tile.x, tile.y);
      }
      case 'tapTile':    return; // legacy; pointer is preferred
      case 'escape':     return this.inventoryUI.hide();
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
    if (target && target.kind === 'enemy') {
      this.combat.execute({ type: 'attack', target: { x: nx, y: ny } },
        this.player, { floor: this.floor, player: this.player });
      this._endPlayerTurn(true);
      return;
    }
    if (this.floor.isPassable(nx, ny)) {
      this.combat.execute({ type: 'move', to: { x: nx, y: ny } },
        this.player, { floor: this.floor, player: this.player });
      this._endPlayerTurn(true);
    }
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
    // Tap-to-walk (the only mobile movement input now that the D-pad is
    // gone). 4-directional: pick the axis with the larger delta so the
    // player advances toward the tapped tile on the most direct cardinal.
    const dxRaw = tx - this.player.x;
    const dyRaw = ty - this.player.y;
    if (dxRaw === 0 && dyRaw === 0) {
      // Tap on self → pick up under foot if anything, else wait one turn.
      const stack = this.floor.itemsAt(tx, ty);
      if (stack.length > 0) this._playerPickup();
      else this._endPlayerTurn(true);
      return;
    }
    let dx = 0, dy = 0;
    if (Math.abs(dxRaw) >= Math.abs(dyRaw)) dx = Math.sign(dxRaw);
    else dy = Math.sign(dyRaw);
    this._playerMove(dx, dy);
  }

  // --- turn management -----------------------------------------------
  _endPlayerTurn(actionTaken) {
    if (!actionTaken) return;
    this.player.runStats.turnsUsed += 1;
    this.combat.tickEntity(this.player);
    if (this.player.isDead) { this._endRun(false); return; }
    this._runEnemyTurns();
    // CRITICAL: enemy turns can kill the player. Without this check the
    // GameOver scene never triggered and the player was stuck on a dead
    // body that couldn't input. Bug from v0.2.0 first playtest.
    if (this.player.isDead) { this._endRun(false); return; }
    this.pathfinding.invalidate();
    this.lighting.compute(this.floor, this.player);

    // Damage-tracking for perfect-floor bonus.
    if (this.player.stats.hp < this.player.stats.hpMax) this.floor.clearedWithoutDamage = false;
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
    for (const s of spawns.enemies) {
      const def = this.content.enemies[s.defId];
      if (!def) { console.warn(LOG.ENTITY, `no enemy def "${s.defId}"`); continue; }
      const BehaviorCls = BEHAVIORS[def.behavior] || ChaseBehavior;
      const behavior = new BehaviorCls(def.behaviorParams);
      const enemy = new Enemy(def, behavior, { x: s.x, y: s.y });
      enemy.snapRender();
      floor.addEntity(enemy);
    }
    for (const s of spawns.items) {
      const item = this.itemFactory.create(s.defId, 1);
      if (item) floor.addItem(s.x, s.y, item);
    }
  }

  _applyMetaUnlocks() {
    const meta = this.state.state.meta;
    if (!meta?.unlocks) return;
    for (const id of meta.unlocks) {
      if (id === 'worn_dagger') {
        const dagger = this.itemFactory.create('rusted_cleaver', 1);
        if (dagger) {
          const swap = this.player.equip(dagger);
          if (swap) this.player.inventory.add(swap);
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
    const summary = { ...this.player.runStats, died: !victory };
    if (victory) this.bus.emit('run:victory', summary);
    else this.bus.emit('run:over', summary);
  }

  // --- commands from UI ----------------------------------------------
  _wireCommands() {
    this.bus.on('command:useSlot',  ({ index }) => { this._playerUseSlot(index); this.inventoryUI.hide(); });
    this.bus.on('command:equipSlot',({ index }) => { this._playerUseSlot(index); this.inventoryUI.hide(); });
    this.bus.on('command:dropSlot', ({ index }) => this._dropSlot(index));
  }

  _dropSlot(index) {
    const item = this.player.inventory.takeAll(index);
    if (!item) return;
    this.floor.addItem(this.player.x, this.player.y, item);
    this.bus.emit('item:dropped', { item });
  }
}

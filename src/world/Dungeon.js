/**
 * Dungeon — the stack of floors for one run.
 *
 * Owns generation cadence and the "current floor" index. Floor instances are
 * generated lazily on descend so memory stays bounded and seeds remain
 * deterministic regardless of which floors the player has explored.
 *
 * The player entity is owned by the run (not the dungeon) and is moved between
 * floors via `descend()` / `setCurrentFloor()`.
 */
import { LOG } from '../config/constants.js';
import { DungeonGenerator } from './DungeonGenerator.js';

export class Dungeon {
  /**
   * @param {object} deps { balance, rng, content }
   */
  constructor({ balance, rng, content }) {
    this.balance = balance;
    this.rng = rng;
    this.content = content;
    this.generator = new DungeonGenerator(balance, rng.fork('dungeon'));

    this.floorDefs = (content.floors && content.floors.floors) || [];
    /** @type {Map<number, { floor: import('./Floor.js').Floor, spawns: object }>} */
    this._cache = new Map();
    this.currentIndex = 0;
  }

  get totalFloors() {
    return this.floorDefs.length;
  }

  isFinalFloor(index = this.currentIndex) {
    const def = this.floorDefs[index];
    return !!(def && def.isFinalFloor);
  }

  /**
   * Get (and generate, if necessary) a floor.
   * @returns {{ floor: import('./Floor.js').Floor, spawns: object }}
   */
  getOrGenerate(index) {
    if (this._cache.has(index)) return this._cache.get(index);
    const def = this.floorDefs[index];
    if (!def) throw new Error(`Dungeon: no floor definition for index ${index}`);
    const result = this.generator.generate(
      index,
      def,
      this.content.items || {},
      this.content.enemies || {}
    );
    this._cache.set(index, result);
    console.log(LOG.DUNGEON, `generated floor ${index + 1} — ${def.name}`,
      { rooms: result.floor.rooms.length, enemies: result.spawns.enemies.length });
    return result;
  }

  current() {
    return this.getOrGenerate(this.currentIndex);
  }

  /**
   * Move the cursor to the next floor. Caller is responsible for placing the
   * player entity onto the new floor.
   * @returns {{ floor: import('./Floor.js').Floor, spawns: object } | null}
   *          null if there is no next floor (final floor cleared).
   */
  descend() {
    const next = this.currentIndex + 1;
    if (next >= this.floorDefs.length) return null;
    this.currentIndex = next;
    return this.current();
  }
}

/**
 * Floor — one dungeon level. Owns:
 *   - tile grid (2D array of Tile)
 *   - list of rooms (rects, used by spawn logic and minimap)
 *   - entity registry  (id -> entity)
 *   - items-on-ground  (key 'x,y' -> array of itemIds-or-instances)
 *   - stairs coordinates
 *
 * Stores spatial-index dictionaries so per-turn queries (entityAt, itemsAt)
 * are O(1) instead of scanning a list. Lists are kept too for iteration.
 */
import { TILE, GRID_WIDTH, GRID_HEIGHT } from '../config/constants.js';
import { Tile } from './Tile.js';

export class Floor {
  /**
   * @param {number} index 0-based floor number
   * @param {object} definition entry from data/floors.json
   * @param {number} seed for any per-floor RNG forking
   */
  constructor(index, definition, seed) {
    this.index = index;
    this.definition = definition;
    this.seed = seed;
    this.width = GRID_WIDTH;
    this.height = GRID_HEIGHT;

    /** @type {Tile[][]} indexed [y][x] */
    this.tiles = Floor._createGrid(this.width, this.height);

    /** @type {Array<{x:number,y:number,w:number,h:number}>} */
    this.rooms = [];

    /** @type {Map<string, object>} id -> entity (player or enemy) */
    this.entities = new Map();
    /** Fast lookup: 'x,y' -> entity id (one entity per tile rule). */
    this._entityIndex = new Map();

    /** @type {Map<string, object[]>} 'x,y' -> items on the ground there */
    this.items = new Map();

    this.stairsDown = null;
    this.stairsUp = null;

    this.playerSpawn = null;

    // Set true when player has cleared all enemies on this floor (for scoring).
    this.clearedWithoutDamage = true;
  }

  static _createGrid(w, h) {
    const grid = new Array(h);
    for (let y = 0; y < h; y++) {
      grid[y] = new Array(w);
      for (let x = 0; x < w; x++) {
        grid[y][x] = new Tile(x, y, TILE.VOID);
      }
    }
    return grid;
  }

  // --- tile access ----------------------------------------------------
  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  tileAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.tiles[y][x];
  }

  setTile(x, y, type) {
    if (!this.inBounds(x, y)) return;
    this.tiles[y][x].type = type;
  }

  /** True if the tile is walkable AND no entity stands there. */
  isPassable(x, y) {
    const t = this.tileAt(x, y);
    if (!t || !t.isWalkable()) return false;
    return !this._entityIndex.has(Floor._key(x, y));
  }

  // --- entities -------------------------------------------------------
  /**
   * @param {{ id:string, x:number, y:number }} entity
   */
  addEntity(entity) {
    if (!entity || !entity.id) throw new Error('Floor.addEntity: entity needs id');
    this.entities.set(entity.id, entity);
    this._entityIndex.set(Floor._key(entity.x, entity.y), entity.id);
  }

  removeEntity(entity) {
    if (!entity) return;
    this.entities.delete(entity.id);
    const key = Floor._key(entity.x, entity.y);
    if (this._entityIndex.get(key) === entity.id) {
      this._entityIndex.delete(key);
    }
  }

  /**
   * Move an entity already on the floor to a new tile. Updates spatial index.
   */
  moveEntity(entity, nx, ny) {
    const oldKey = Floor._key(entity.x, entity.y);
    if (this._entityIndex.get(oldKey) === entity.id) {
      this._entityIndex.delete(oldKey);
    }
    entity.x = nx;
    entity.y = ny;
    this._entityIndex.set(Floor._key(nx, ny), entity.id);
  }

  entityAt(x, y) {
    const id = this._entityIndex.get(Floor._key(x, y));
    return id ? this.entities.get(id) : null;
  }

  enemies() {
    const out = [];
    for (const e of this.entities.values()) {
      if (e.kind === 'enemy' && !e.isDead) out.push(e);
    }
    return out;
  }

  // --- items ----------------------------------------------------------
  addItem(x, y, item) {
    const key = Floor._key(x, y);
    let list = this.items.get(key);
    if (!list) {
      list = [];
      this.items.set(key, list);
    }
    list.push(item);
  }

  itemsAt(x, y) {
    return this.items.get(Floor._key(x, y)) || [];
  }

  takeItemAt(x, y) {
    const key = Floor._key(x, y);
    const list = this.items.get(key);
    if (!list || list.length === 0) return null;
    const taken = list.shift();
    if (list.length === 0) this.items.delete(key);
    return taken;
  }

  // --- vision ---------------------------------------------------------
  /**
   * Reset transient visibility (called each turn before recomputing).
   */
  clearVisibility() {
    for (let y = 0; y < this.height; y++) {
      const row = this.tiles[y];
      for (let x = 0; x < this.width; x++) {
        row[x].visible = false;
      }
    }
  }

  /** Reveal every tile (Scroll of Mapping). Does NOT change current visibility. */
  revealAll() {
    for (let y = 0; y < this.height; y++) {
      const row = this.tiles[y];
      for (let x = 0; x < this.width; x++) {
        row[x].explored = true;
      }
    }
  }

  static _key(x, y) {
    return `${x},${y}`;
  }
}

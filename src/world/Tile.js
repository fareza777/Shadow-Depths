/**
 * Tile — passive data carrier. Tiles don't hold entities or items directly;
 * Floor maintains those lookups by (x, y). This avoids reference cycles and
 * keeps tiles cheap to copy / serialize.
 *
 * Vision state lives on the tile:
 *   explored — has the player ever seen this tile? (drawn dim if not visible now)
 *   visible  — is the tile inside the current torch radius this turn?
 */
import { TILE } from '../config/constants.js';

export class Tile {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} type one of TILE.*
   */
  constructor(x, y, type = TILE.VOID) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.explored = false;
    this.visible = false;
    /** Optional trap: { type, armed, revealed } — see gameplay/hazards.js. */
    this.hazard = null;
    /** Floor micro-event interactable: { kind, used, ... }. */
    this.interact = null;
    /** Persistent zone hazard (frost/venom cloud) while standing on tile. */
    this.ambient = null;
    /** Secret door: a WALL that opens to a hidden cache when found. */
    this.secret = null;
    /**
     * Locked vault door: `{ locked: boolean }` on a TILE.DOOR. Absent on
     * ordinary doors — the secret-cache reveal makes a plain DOOR and must
     * keep behaving as an open doorway.
     */
    this.door = null;
    /** Cosmetic room/wall dressing: { kind, wall }. Never affects gameplay. */
    this.decor = null;
  }

  /** True while this is a door that still needs its key. */
  isLockedDoor() {
    return this.type === TILE.DOOR && !!this.door?.locked;
  }

  /** Does this tile block movement? Includes walls, voids, locked doors. */
  isBlocking() {
    return this.type === TILE.WALL || this.type === TILE.VOID || this.isLockedDoor();
  }

  /** Does this tile block line-of-sight? A locked door hides its vault. */
  blocksSight() {
    return this.type === TILE.WALL || this.type === TILE.VOID || this.isLockedDoor();
  }

  /** True if an entity can stand on this tile (still subject to entity collision). */
  isWalkable() {
    // A solid interactable (merchant stall, shrine idol) occupies the tile —
    // it's a structure you use from an adjacent tile, never stand on.
    if (this.interact?.solid && !this.interact.used) return false;
    if (this.isLockedDoor()) return false;
    return this.type === TILE.FLOOR
        || this.type === TILE.DOOR
        || this.type === TILE.STAIRS_DOWN
        || this.type === TILE.STAIRS_UP;
  }
}

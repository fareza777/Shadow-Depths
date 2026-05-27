/**
 * DungeonGenerator — BSP (Binary Space Partitioning).
 *
 * Algorithm:
 *   1. Start with the full floor rect as a single node.
 *   2. Recursively split each node (alternating axis) until depth limit or
 *      the node is too small to split sensibly.
 *   3. For each leaf, carve a room inside it (4×4..9×9, with random padding).
 *   4. Connect siblings via a corridor between the center of each child.
 *
 * Output: a populated Floor (tiles carved, rooms recorded, stairs placed,
 * enemies + items spawned, player spawn chosen). The generator does not
 * instantiate entity classes — it returns spawn descriptors so Part 3 can
 * factory them with the correct dependencies.
 */
import {
  TILE, GRID_WIDTH, GRID_HEIGHT
} from '../config/constants.js';
import { Floor } from './Floor.js';
import { rollItemAffixes } from '../items/itemGenerator.js';

const MAX_DEPTH = 4; // 2^4 = up to 16 leaf rooms
const MIN_LEAF_SIZE = 7; // must fit roomMin (4) + 1 padding on each side

export class DungeonGenerator {
  /**
   * @param {object} balance merged balance config
   * @param {import('../core/RNG.js').RNG} rng
   */
  constructor(balance, rng) {
    this.balance = balance;
    this.rng = rng;
  }

  /**
   * Generate a single floor.
   * @param {number} floorIndex
   * @param {object} floorDef entry from data/floors.json
   * @returns {{
   *   floor: Floor,
   *   spawns: {
   *     player: { x:number, y:number },
   *     enemies: Array<{ x:number, y:number, defId:string }>,
   *     items:   Array<{ x:number, y:number, defId:string }>
   *   }
   * }}
   */
  generate(floorIndex, floorDef, itemDefs, enemyDefs) {
    const seed = (this.rng.seed ^ ((floorIndex + 1) * 0x9E3779B1)) >>> 0;
    const floor = new Floor(floorIndex, floorDef, seed);

    // 1. Carve rooms via BSP.
    const root = { x: 1, y: 1, w: GRID_WIDTH - 2, h: GRID_HEIGHT - 2 };
    const leaves = [];
    this._split(root, 0, leaves);

    const minRooms = this.balance.dungeon.minRoomsPerFloor;
    const maxRooms = this.balance.dungeon.maxRoomsPerFloor;
    // Take a random subset within [min, max].
    const targetCount = Math.min(
      leaves.length,
      this.rng.randInt(minRooms, maxRooms)
    );
    const picked = this.rng.shuffle(leaves).slice(0, targetCount);

    const rooms = [];
    for (const leaf of picked) {
      const room = this._carveRoom(floor, leaf);
      if (room) rooms.push(room);
    }
    floor.rooms = rooms;

    // 2. Connect adjacent rooms with corridors.
    this._connectRooms(floor, rooms);

    // 3. Wall pass: any FLOOR tile with a VOID neighbor becomes a WALL ring.
    this._wrapWithWalls(floor);

    // 4. Place stairs in the room farthest from the picked spawn room.
    const spawnRoom = rooms[0];
    const spawnPoint = DungeonGenerator._roomCenter(spawnRoom);
    floor.playerSpawn = spawnPoint;

    const minDist = this.balance.dungeon.minStairsDistance;
    const finalFloor = floorDef.isFinalFloor === true;
    if (!finalFloor) {
      const stairsRoom = this._farthestRoom(rooms, spawnPoint, minDist);
      const sp = DungeonGenerator._roomCenter(stairsRoom);
      floor.setTile(sp.x, sp.y, TILE.STAIRS_DOWN);
      floor.stairsDown = sp;
    }
    // Mark spawn tile with stairs_up for context (visual only, no effect v0.1).
    floor.setTile(spawnPoint.x, spawnPoint.y, TILE.FLOOR);
    floor.stairsUp = spawnPoint;

    // 5. Spawn enemies + items.
    const spawns = {
      player: spawnPoint,
      enemies: this._spawnEnemies(floor, rooms, spawnRoom, floorDef, enemyDefs),
      items: this._spawnItems(floor, rooms, spawnRoom, floorDef, itemDefs, floorIndex)
    };

    return { floor, spawns };
  }

  // --- BSP partitioning ----------------------------------------------
  _split(node, depth, out) {
    const canSplitHoriz = node.h >= MIN_LEAF_SIZE * 2;
    const canSplitVert  = node.w >= MIN_LEAF_SIZE * 2;
    if (depth >= MAX_DEPTH || (!canSplitHoriz && !canSplitVert)) {
      if (node.w >= MIN_LEAF_SIZE && node.h >= MIN_LEAF_SIZE) {
        out.push(node);
      }
      return;
    }
    // Prefer splitting the longer axis, but with some randomness.
    let horizontal;
    if (canSplitHoriz && !canSplitVert) horizontal = true;
    else if (canSplitVert && !canSplitHoriz) horizontal = false;
    else horizontal = node.w > node.h ? this.rng.chance(0.3) : this.rng.chance(0.7);

    if (horizontal) {
      const min = MIN_LEAF_SIZE;
      const max = node.h - MIN_LEAF_SIZE;
      const cut = this.rng.randInt(min, max);
      this._split({ x: node.x, y: node.y, w: node.w, h: cut }, depth + 1, out);
      this._split({ x: node.x, y: node.y + cut, w: node.w, h: node.h - cut }, depth + 1, out);
    } else {
      const min = MIN_LEAF_SIZE;
      const max = node.w - MIN_LEAF_SIZE;
      const cut = this.rng.randInt(min, max);
      this._split({ x: node.x, y: node.y, w: cut, h: node.h }, depth + 1, out);
      this._split({ x: node.x + cut, y: node.y, w: node.w - cut, h: node.h }, depth + 1, out);
    }
  }

  _carveRoom(floor, leaf) {
    const minSize = this.balance.dungeon.roomMinSize;
    const maxSize = this.balance.dungeon.roomMaxSize;
    const maxW = Math.min(maxSize, leaf.w - 2);
    const maxH = Math.min(maxSize, leaf.h - 2);
    if (maxW < minSize || maxH < minSize) return null;
    const w = this.rng.randInt(minSize, maxW);
    const h = this.rng.randInt(minSize, maxH);
    const x = leaf.x + this.rng.randInt(1, leaf.w - w - 1);
    const y = leaf.y + this.rng.randInt(1, leaf.h - h - 1);
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        floor.setTile(rx, ry, TILE.FLOOR);
      }
    }
    return { x, y, w, h };
  }

  _connectRooms(floor, rooms) {
    // Simple strategy: connect each room to the next in order; then sprinkle
    // a couple of extra edges for loops (so layout isn't a pure tree).
    for (let i = 0; i < rooms.length - 1; i++) {
      this._corridor(floor, DungeonGenerator._roomCenter(rooms[i]),
                            DungeonGenerator._roomCenter(rooms[i + 1]));
    }
    const extras = Math.min(2, Math.floor(rooms.length / 4));
    for (let i = 0; i < extras; i++) {
      const a = this.rng.pick(rooms);
      const b = this.rng.pick(rooms);
      if (a !== b) {
        this._corridor(floor, DungeonGenerator._roomCenter(a),
                              DungeonGenerator._roomCenter(b));
      }
    }
  }

  _corridor(floor, a, b) {
    // L-shaped, random elbow direction.
    if (this.rng.chance(0.5)) {
      this._hLine(floor, a.x, b.x, a.y);
      this._vLine(floor, a.y, b.y, b.x);
    } else {
      this._vLine(floor, a.y, b.y, a.x);
      this._hLine(floor, a.x, b.x, b.y);
    }
  }

  _hLine(floor, x1, x2, y) {
    const [lo, hi] = x1 < x2 ? [x1, x2] : [x2, x1];
    for (let x = lo; x <= hi; x++) floor.setTile(x, y, TILE.FLOOR);
  }
  _vLine(floor, y1, y2, x) {
    const [lo, hi] = y1 < y2 ? [y1, y2] : [y2, y1];
    for (let y = lo; y <= hi; y++) floor.setTile(x, y, TILE.FLOOR);
  }

  _wrapWithWalls(floor) {
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (floor.tiles[y][x].type !== TILE.FLOOR) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (!floor.inBounds(nx, ny)) continue;
            if (floor.tiles[ny][nx].type === TILE.VOID) {
              floor.tiles[ny][nx].type = TILE.WALL;
            }
          }
        }
      }
    }
  }

  // --- placement helpers ---------------------------------------------
  static _roomCenter(r) {
    return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
  }

  _farthestRoom(rooms, from, minDist) {
    let best = rooms[rooms.length - 1];
    let bestDist = -1;
    for (const r of rooms) {
      const c = DungeonGenerator._roomCenter(r);
      const d = Math.abs(c.x - from.x) + Math.abs(c.y - from.y);
      if (d > bestDist && d >= minDist) { best = r; bestDist = d; }
    }
    // Fallback if no room met minDist: just pick the geometrically farthest.
    if (bestDist < 0) {
      for (const r of rooms) {
        const c = DungeonGenerator._roomCenter(r);
        const d = Math.abs(c.x - from.x) + Math.abs(c.y - from.y);
        if (d > bestDist) { best = r; bestDist = d; }
      }
    }
    return best;
  }

  _spawnEnemies(floor, rooms, spawnRoom, floorDef, enemyDefs) {
    const count = floorDef.enemyCount ?? this.balance.dungeon.enemySpawnsPerFloor[floorDef.index] ?? 3;
    const floorNum = (floorDef.index ?? 0) + 1;
    const pool = (floorDef.enemyPool || []).filter((id) => {
      const def = enemyDefs[id];
      if (!def || def.spawnWeight === 0) return false;
      return (def.floorMin ?? 1) <= floorNum;
    });
    if (pool.length === 0) return [];

    const weighted = pool.map((id) => ({ value: id, weight: enemyDefs[id].spawnWeight || 1 }));
    const spawns = [];
    const candidates = rooms.filter((r) => r !== spawnRoom);
    const reserved = new Set();
    if (floorDef.specialEnemyId && enemyDefs[floorDef.specialEnemyId]) {
      const bossRoom = this._farthestRoom(candidates.length ? candidates : rooms, floor.playerSpawn, 0);
      const tile = this._randomTileInRoom(floor, bossRoom, reserved);
      if (tile) {
        reserved.add(`${tile.x},${tile.y}`);
        spawns.push({ x: tile.x, y: tile.y, defId: floorDef.specialEnemyId });
      }
    }
    for (let i = 0; i < count; i++) {
      const room = this.rng.pick(candidates.length ? candidates : rooms);
      const tile = this._randomTileInRoom(floor, room, reserved);
      if (!tile) continue;
      reserved.add(`${tile.x},${tile.y}`);
      const defId = this.rng.weightedPick(weighted);
      spawns.push({ x: tile.x, y: tile.y, defId });
    }
    return spawns;
  }

  _spawnItems(floor, rooms, spawnRoom, floorDef, itemDefs, floorIndex) {
    const count = floorDef.itemCount ?? this.balance.dungeon.itemSpawnsPerFloor[floorIndex] ?? 5;
    const eligible = Object.values(itemDefs).filter(
      (def) => (def.floorMin ?? 1) <= floorIndex + 1
    );
    if (eligible.length === 0) return [];
    const weighted = eligible.map((d) => ({ value: d.id, weight: d.spawnWeight || 1 }));
    const spawns = [];
    for (let i = 0; i < count; i++) {
      const room = this.rng.pick(rooms);
      const tile = this._randomTileInRoom(floor, room);
      if (!tile) continue;
      const defId = this.rng.weightedPick(weighted);
      // Roll affix at spawn time so save/load and codex stay deterministic.
      // Vault floors get a depth nudge so they roll a tier or two higher.
      const baseDef = itemDefs[defId];
      const effectiveDepth = floorIndex + 1 + (floorDef.vaultDepthBoost || 0);
      const affixes = baseDef ? rollItemAffixes(baseDef, effectiveDepth, this.rng) : null;
      const entry = { x: tile.x, y: tile.y, defId };
      if (affixes) entry.affixes = affixes;
      spawns.push(entry);
    }
    return spawns;
  }

  _randomTileInRoom(floor, room, reserved = null) {
    // Try up to 10 times to find a free FLOOR tile (not stairs).
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = this.rng.randInt(room.x, room.x + room.w - 1);
      const y = this.rng.randInt(room.y, room.y + room.h - 1);
      const t = floor.tileAt(x, y);
      if (t && t.type === TILE.FLOOR && !reserved?.has(`${x},${y}`)) return { x, y };
    }
    return null;
  }
}

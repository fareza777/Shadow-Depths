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
import { trapCountForDepth, pickHazardType } from '../gameplay/hazards.js';
import { FloorEventPlacer } from './FloorEventPlacer.js';

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

    // Boss arena: one big centered room, no corridors, no stairs down.
    if (floorDef.isFinalFloor === true) {
      return this._generateBossArena(floor, floorDef, itemDefs, enemyDefs);
    }

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

    // 5b. Maybe hide a secret cache behind a breakable wall (optional loot).
    if (!floorDef.tutorial) {
      this._placeSecretCache(floor, rooms, spawnRoom, floorDef, floorIndex, spawns, itemDefs);
    }

    // 6. Maybe turn one room into an arena set-piece (guards + reward).
    if (!floorDef.tutorial) {
      this._augmentArena(floor, rooms, spawnRoom, floorDef, floorIndex, spawns, enemyDefs, itemDefs);
    }

    // 7. Scatter hidden traps (avoid spawn room, stairs, doors, occupied tiles).
    if (!floorDef.tutorial) {
      this._placeHazards(floor, rooms, spawnRoom, floorIndex, spawns);
    }

    // 8. Micro-events per floor (2–3 on normal floors).
    if (!floorDef.isFinalFloor && !floorDef.tutorial) {
      const placer = new FloorEventPlacer(this.rng.fork(`event:${floorIndex}`), this.balance);
      const kinds = placer.placeAll(floor, rooms, spawnRoom, floorDef, floorIndex, spawns, enemyDefs, itemDefs);
      if (kinds.length) {
        floor.definition = {
          ...floorDef,
          microEventKinds: kinds,
          microEventKind: kinds[0]
        };
      }
    }

    // 9. Forge floors: a solid anvil-shrine in a room centre (used from beside).
    if (floorDef.type === 'forge') {
      this._placeForgeAnvil(floor, rooms, spawnPoint, spawns);
    }

    // 10. Cosmetic room dressing and tutorial guide. These never change
    // movement or combat rules; solid NPCs are placed last and reserved.
    this._placeRoomDecor(floor, rooms, spawnRoom, floorDef, spawns);
    if (floorDef.tutorial) this._placeTutorialKeeper(floor, rooms, spawnPoint, spawns, floorDef);

    return { floor, spawns };
  }

  /**
   * Place the Veiled Smith's anvil as a solid interactable at a room centre
   * (never the spawn/stairs tile, never a doorway). The player crafts from an
   * adjacent tile. Runs last so no later spawn can land on it.
   */
  _placeForgeAnvil(floor, rooms, spawnPoint, spawns) {
    const reserved = new Set([`${spawnPoint.x},${spawnPoint.y}`]);
    if (floor.stairsDown) reserved.add(`${floor.stairsDown.x},${floor.stairsDown.y}`);
    for (const it of spawns.items) reserved.add(`${it.x},${it.y}`);
    for (const en of spawns.enemies) reserved.add(`${en.x},${en.y}`);

    const ordered = rooms.slice().sort((a, b) => (b.w * b.h) - (a.w * a.h));
    for (const room of ordered) {
      const cx = Math.floor(room.x + room.w / 2);
      const cy = Math.floor(room.y + room.h / 2);
      const tries = [[cx, cy], [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
      for (const [x, y] of tries) {
        // Stay strictly interior so the anvil can never seal a doorway.
        if (x <= room.x || x >= room.x + room.w - 1) continue;
        if (y <= room.y || y >= room.y + room.h - 1) continue;
        const t = floor.tileAt(x, y);
        if (!t || t.type !== TILE.FLOOR || t.hazard || t.interact) continue;
        if (reserved.has(`${x},${y}`)) continue;
        if (floor.itemsAt(x, y).length || floor.entityAt(x, y)) continue;
        t.interact = { kind: 'forge', solid: true, used: false };
        floor.forgeAnvil = { x, y };
        return true;
      }
    }
    return false;
  }

  _placeTutorialKeeper(floor, rooms, spawnPoint, spawns, floorDef) {
    const reserved = new Set([`${spawnPoint.x},${spawnPoint.y}`]);
    if (floor.stairsDown) reserved.add(`${floor.stairsDown.x},${floor.stairsDown.y}`);
    for (const it of spawns.items) reserved.add(`${it.x},${it.y}`);
    for (const en of spawns.enemies) reserved.add(`${en.x},${en.y}`);

    const room = rooms[0];
    const c = DungeonGenerator._roomCenter(room);
    const candidates = [
      [spawnPoint.x + 1, spawnPoint.y],
      [spawnPoint.x, spawnPoint.y + 1],
      [spawnPoint.x - 1, spawnPoint.y],
      [c.x, c.y],
      [c.x + 1, c.y]
    ];
    for (const [x, y] of candidates) {
      const t = floor.tileAt(x, y);
      if (!t || t.type !== TILE.FLOOR || t.interact || t.hazard) continue;
      if (reserved.has(`${x},${y}`)) continue;
      t.interact = {
        kind: 'keeper',
        solid: true,
        label: 'The Keeper',
        line: floorDef.tutorialStep === 'trial'
          ? 'Second lesson: manage distance, pick rewards, then descend.'
          : 'First lesson: move one tile at a time, read danger, and use PICK beside me.'
      };
      floor.keeper = { x, y };
      return true;
    }
    return false;
  }

  _placeRoomDecor(floor, rooms, spawnRoom, floorDef, spawns) {
    const solid = new Set();
    if (floor.playerSpawn) solid.add(`${floor.playerSpawn.x},${floor.playerSpawn.y}`);
    if (floor.stairsDown) solid.add(`${floor.stairsDown.x},${floor.stairsDown.y}`);
    if (floor.forgeAnvil) solid.add(`${floor.forgeAnvil.x},${floor.forgeAnvil.y}`);
    for (const it of spawns.items || []) solid.add(`${it.x},${it.y}`);
    for (const en of spawns.enemies || []) solid.add(`${en.x},${en.y}`);

    const wallKinds = [
      { value: 'wall_torch', weight: 5 },
      { value: 'wall_chains', weight: 4 },
      { value: 'rune_crack', weight: 4 },
      { value: 'cobweb', weight: 4 },
      { value: 'banner', weight: 1 }
    ];
    const floorKinds = ['brazier', 'bone_pile', 'broken_pillar', 'gargoyle'];
    const wallCount = floorDef.tutorial ? 10 : this.rng.randInt(20, 30);
    const floorCount = floorDef.tutorial ? 4 : this.rng.randInt(8, 14);

    const wallCandidates = [];
    const floorCandidates = [];
    const nearFloor = (x, y) => {
      const n = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      return n.some(([dx, dy]) => floor.tileAt(x + dx, y + dy)?.type === TILE.FLOOR);
    };
    for (let y = 1; y < floor.height - 1; y++) {
      for (let x = 1; x < floor.width - 1; x++) {
        const t = floor.tileAt(x, y);
        if (t?.type === TILE.WALL && !t.decor && !t.secret && nearFloor(x, y)) {
          if (!floorDef.tutorial && spawnRoom
          && x >= spawnRoom.x - 1 && x <= spawnRoom.x + spawnRoom.w
          && y >= spawnRoom.y - 1 && y <= spawnRoom.y + spawnRoom.h) continue;
          wallCandidates.push(t);
        }
      }
    }
    for (const room of rooms) {
      if (room === spawnRoom && !floorDef.tutorial) continue;
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          const t = floor.tileAt(x, y);
          if (!t || t.type !== TILE.FLOOR || t.decor || t.interact || t.hazard) continue;
          if (solid.has(`${x},${y}`)) continue;
          const nearWall = x <= room.x + 1 || y <= room.y + 1
            || x >= room.x + room.w - 2 || y >= room.y + room.h - 2;
          const largeRoomCenter = room.large && x > room.x + 2 && y > room.y + 2
            && x < room.x + room.w - 3 && y < room.y + room.h - 3;
          if (nearWall || largeRoomCenter) floorCandidates.push(t);
        }
      }
    }

    const put = (tile, kind, wall = false) => {
      if (!tile || tile.decor || tile.interact) return false;
      tile.decor = { kind, wall };
      return true;
    };

    if (floorDef.tutorial && spawnRoom) {
      // The tutorial gets a hand-placed, symmetric set only — no random
      // scatter — so the lesson room reads deliberate, not cluttered.
      const sx = spawnRoom.x, sy = spawnRoom.y, sw = spawnRoom.w, sh = spawnRoom.h;
      const cx = Math.floor(sx + sw / 2), cy = Math.floor(sy + sh / 2);
      // Keep the hero's start + the ring around it (the Keeper's tile) clear.
      const keep = new Set([
        `${cx},${cy}`, `${cx + 1},${cy}`, `${cx - 1},${cy}`,
        `${cx},${cy + 1}`, `${cx},${cy - 1}`
      ]);

      // Wall landmarks: two torches flanking a central banner up top, a chain
      // and a glowing rune-crack on opposite side walls — the exact cues the
      // Keeper's script points at.
      const wallDecor = [
        [cx - 2, sy - 1, 'wall_torch'], [cx + 2, sy - 1, 'wall_torch'],
        [cx, sy - 1, 'banner'],
        [sx - 1, cy, 'wall_chains'], [sx + sw, cy, 'rune_crack'],
        [sx + 1, sy + sh, 'cobweb']
      ];
      for (const [x, y, kind] of wallDecor) {
        const tile = floor.tileAt(x, y);
        if (tile?.type === TILE.WALL && !tile.decor && !solid.has(`${x},${y}`)) put(tile, kind, true);
      }
      // Floor dressing tucked into the four corners only — never on the play
      // path. No gargoyle (it reads as a foe); the bone pile sits in a far
      // corner as a landmark rather than something you walk up to.
      const floorDecor = [
        [sx + 1, sy + 1, 'brazier'], [sx + sw - 2, sy + 1, 'brazier'],
        [sx + 1, sy + sh - 2, 'bone_pile'], [sx + sw - 2, sy + sh - 2, 'broken_pillar']
      ];
      for (const [x, y, kind] of floorDecor) {
        const tile = floor.tileAt(x, y);
        if (tile?.type === TILE.FLOOR && !tile.decor && !tile.interact
            && !solid.has(`${x},${y}`) && !keep.has(`${x},${y}`)) put(tile, kind, false);
      }
      return; // tutorial layout is fully curated — skip the random scatter
    }

    let placed = 0;
    for (const tile of this.rng.shuffle(wallCandidates).slice(0, wallCount)) {
      if (put(tile, this.rng.weightedPick(wallKinds), true)) placed++;
      if (placed >= wallCount) break;
    }
    placed = 0;
    for (const tile of this.rng.shuffle(floorCandidates).slice(0, floorCount)) {
      if (put(tile, this.rng.pick(floorKinds), false)) placed++;
      if (placed >= floorCount) break;
    }
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
    // A fraction of rooms become a large hall / cavern — they expand toward
    // the whole leaf (past the normal max) so the floor isn't all same-size
    // boxes. Marked `large` so spawners can treat them as set-pieces.
    const large = this.rng.chance(this.balance.dungeon.largeRoomChance ?? 0.2);
    const capW = Math.min(large ? leaf.w - 2 : maxSize, leaf.w - 2);
    const capH = Math.min(large ? leaf.h - 2 : maxSize, leaf.h - 2);
    if (capW < minSize || capH < minSize) return null;
    const minW = large ? Math.max(minSize, Math.floor(capW * 0.7)) : minSize;
    const minH = large ? Math.max(minSize, Math.floor(capH * 0.7)) : minSize;
    const w = this.rng.randInt(Math.min(minW, capW), capW);
    const h = this.rng.randInt(Math.min(minH, capH), capH);
    const x = leaf.x + this.rng.randInt(1, leaf.w - w - 1);
    const y = leaf.y + this.rng.randInt(1, leaf.h - h - 1);
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        floor.setTile(rx, ry, TILE.FLOOR);
      }
    }
    return { x, y, w, h, large };
  }

  /**
   * Scatter hidden one-shot traps on plain floor tiles. Skips the spawn room,
   * stairs, doors, the player-spawn tile, and tiles already holding a spawned
   * enemy or item so the player never opens on (or is forced onto) a trap.
   */
  _placeHazards(floor, rooms, spawnRoom, floorIndex, spawns) {
    const cfg = this.balance.dungeon.trapsPerFloor || { min: 1, max: 4 };
    const count = trapCountForDepth(floorIndex, this.rng, cfg);
    if (count <= 0) return;

    const occupied = new Set();
    for (const e of spawns.enemies || []) occupied.add(`${e.x},${e.y}`);
    for (const it of spawns.items || []) occupied.add(`${it.x},${it.y}`);
    const inSpawnRoom = (x, y) => spawnRoom
      && x >= spawnRoom.x - 1 && x < spawnRoom.x + spawnRoom.w + 1
      && y >= spawnRoom.y - 1 && y < spawnRoom.y + spawnRoom.h + 1;

    // Candidate pool: plain floor tiles outside the spawn room.
    const candidates = [];
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        const t = floor.tiles[y][x];
        if (t.type !== TILE.FLOOR || t.hazard) continue;
        if (inSpawnRoom(x, y)) continue;
        if (occupied.has(`${x},${y}`)) continue;
        candidates.push(t);
      }
    }
    const picks = this.rng.shuffle(candidates).slice(0, count);
    for (const t of picks) {
      t.hazard = { type: pickHazardType(this.rng, floorIndex), armed: true, revealed: false };
    }
  }

  /**
   * Arena set-piece (#6): pick a non-spawn room (preferring a large hall),
   * add a couple of extra guards — one a guaranteed elite — and a guaranteed
   * gear reward. Gives the floor a "clear this and get paid" beat instead of
   * uniform fodder. Skipped on forge/boss floors and very small layouts.
   */

  /**
   * Hide a one-tile loot pocket behind a breakable "secret" wall adjacent to a
   * room. The pocket is carved out of VOID and sealed, so it never touches the
   * main path (no soft-lock risk); the secret wall stays solid until the player
   * stands beside it and notices it (GameScene reveals on adjacency).
   */
  _placeSecretCache(floor, rooms, spawnRoom, floorDef, floorIndex, spawns, itemDefs) {
    if (floorDef.type === 'forge') return;
    if (!this.rng.chance(this.balance.dungeon.secretCacheChance ?? 0.4)) return;

    const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const inB = (x, y) => x >= 1 && y >= 1 && x < floor.width - 1 && y < floor.height - 1;
    const isType = (x, y, t) => floor.inBounds(x, y) && floor.tiles[y][x].type === t;

    for (const room of this.rng.shuffle(rooms.slice())) {
      const fx = room.x + this.rng.randInt(0, room.w - 1);
      const fy = room.y + this.rng.randInt(0, room.h - 1);
      for (const [dx, dy] of this.rng.shuffle(DIRS.slice())) {
        const wx = fx + dx, wy = fy + dy;          // the secret wall
        const px = fx + 2 * dx, py = fy + 2 * dy;  // the pocket
        if (!inB(px, py)) continue;
        // Need: room floor → WALL → VOID pocket, with VOID breathing room beyond.
        if (!isType(fx, fy, TILE.FLOOR)) continue;
        if (!isType(wx, wy, TILE.WALL)) continue;
        if (!isType(px, py, TILE.VOID)) continue;
        if (!isType(px + dx, py + dy, TILE.VOID)) continue;

        // Carve the pocket and seal its VOID neighbours (never overwrite real
        // floor/corridor) so it stays isolated behind the secret wall.
        floor.setTile(px, py, TILE.FLOOR);
        for (let ny = py - 1; ny <= py + 1; ny++) {
          for (let nx = px - 1; nx <= px + 1; nx++) {
            if (nx === wx && ny === wy) continue;       // keep the secret wall
            if (nx === px && ny === py) continue;
            if (isType(nx, ny, TILE.VOID)) floor.setTile(nx, ny, TILE.WALL);
          }
        }
        floor.tiles[wy][wx].secret = { revealed: false };

        // Reward: a piece of gear, affixed at a small depth premium.
        const floorNum = floorIndex + 1;
        const gearPool = Object.values(itemDefs).filter(
          (d) => d.slot && (d.floorMin ?? 1) <= floorNum
        );
        if (gearPool.length) {
          const weighted = gearPool.map((d) => ({ value: d.id, weight: d.spawnWeight || 1 }));
          const defId = this.rng.weightedPick(weighted);
          const baseDef = itemDefs[defId];
          const entry = { x: px, y: py, defId };
          const affixes = baseDef ? rollItemAffixes(baseDef, floorNum + 4, this.rng) : null;
          if (affixes) entry.affixes = affixes;
          spawns.items.push(entry);
        }
        floor.secretCache = { x: px, y: py, wall: { x: wx, y: wy } };
        return; // one cache per floor
      }
    }
  }

  _augmentArena(floor, rooms, spawnRoom, floorDef, floorIndex, spawns, enemyDefs, itemDefs) {
    if (floorDef.type === 'forge' || floorDef.isFinalFloor || rooms.length < 3) return;
    if (!this.rng.chance(this.balance.dungeon.arenaChance ?? 0.35)) return;

    const candidates = rooms.filter((r) => r !== spawnRoom);
    if (!candidates.length) return;
    const larges = candidates.filter((r) => r.large);
    const pool = larges.length ? larges : candidates;
    const arena = this._farthestRoom(pool, floor.playerSpawn, 0);
    if (!arena) return;
    arena.arena = true;
    floor.arenaRoom = arena;

    const reserved = new Set();
    for (const e of spawns.enemies) reserved.add(`${e.x},${e.y}`);
    for (const it of spawns.items) reserved.add(`${it.x},${it.y}`);

    // Guards — drawn from this floor's enemy pool (fodder only).
    const floorNum = floorIndex + 1;
    const enemyPool = (floorDef.enemyPool || []).filter((id) => {
      const def = enemyDefs[id];
      return def && def.spawnWeight !== 0 && (def.floorMin ?? 1) <= floorNum;
    });
    if (enemyPool.length) {
      const weighted = enemyPool.map((id) => ({ value: id, weight: enemyDefs[id].spawnWeight || 1 }));
      for (let i = 0; i < 2; i++) {
        const tile = this._randomTileInRoom(floor, arena, reserved);
        if (!tile) break;
        reserved.add(`${tile.x},${tile.y}`);
        const entry = { x: tile.x, y: tile.y, defId: this.rng.weightedPick(weighted) };
        if (i === 0) entry.forceElite = true; // the arena boss
        spawns.enemies.push(entry);
      }
    }

    // Reward — a guaranteed piece of gear, affixed at a small depth premium.
    const gearPool = Object.values(itemDefs).filter(
      (d) => d.slot && (d.floorMin ?? 1) <= floorNum
    );
    if (gearPool.length) {
      const tile = this._randomTileInRoom(floor, arena, reserved);
      if (tile) {
        const weighted = gearPool.map((d) => ({ value: d.id, weight: d.spawnWeight || 1 }));
        const defId = this.rng.weightedPick(weighted);
        const baseDef = itemDefs[defId];
        const entry = { x: tile.x, y: tile.y, defId };
        const affixes = baseDef ? rollItemAffixes(baseDef, floorNum + 6, this.rng) : null;
        if (affixes) entry.affixes = affixes;
        spawns.items.push(entry);
      }
    }
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
    if (floorDef.type === 'forge' || floorDef.enemyCount === 0) return [];
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
    const roomList = candidates.length ? candidates : rooms.filter((r) => r !== spawnRoom);
    const maxPerRoom = floorNum <= 2 ? 2 : floorNum <= 8 ? 3 : 4;
    const roomCounts = new Map();
    const reserved = new Set();

    if (floorDef.specialEnemyId && enemyDefs[floorDef.specialEnemyId]) {
      const bossRoom = this._farthestRoom(roomList.length ? roomList : rooms, floor.playerSpawn, 0);
      const tile = this._randomTileInRoom(floor, bossRoom, reserved);
      if (tile) {
        reserved.add(`${tile.x},${tile.y}`);
        spawns.push({ x: tile.x, y: tile.y, defId: floorDef.specialEnemyId });
        roomCounts.set(bossRoom, (roomCounts.get(bossRoom) || 0) + 1);
      }
    }

    const pickRoom = () => {
      const underCap = roomList.filter((r) => (roomCounts.get(r) || 0) < maxPerRoom);
      const pickFrom = underCap.length ? underCap : roomList;
      if (!pickFrom.length) return null;
      const room = this.rng.pick(pickFrom);
      roomCounts.set(room, (roomCounts.get(room) || 0) + 1);
      return room;
    };

    for (let i = 0; i < count; i++) {
      const room = pickRoom();
      if (!room) break;
      const tile = this._randomTileInRoom(floor, room, reserved);
      if (!tile) continue;
      reserved.add(`${tile.x},${tile.y}`);
      const defId = this.rng.weightedPick(weighted);
      spawns.push({ x: tile.x, y: tile.y, defId });
    }
    return spawns;
  }

  _spawnItems(floor, rooms, spawnRoom, floorDef, itemDefs, floorIndex) {
    if (floorDef.type === 'forge') {
      return this._spawnForgeMaterials(floor, rooms, spawnRoom, floorDef, itemDefs);
    }
    const count = floorDef.itemCount ?? this.balance.dungeon.itemSpawnsPerFloor[floorIndex] ?? 5;
    const floorNum = floorIndex + 1;
    const eligible = Object.values(itemDefs).filter(
      (def) => def.type !== 'material' && (def.floorMin ?? 1) <= floorNum
    );
    if (eligible.length === 0) return [];

    const gearPool = eligible.filter((d) => d.slot);
    const consumablePool = eligible.filter((d) => d.type === 'consumable');
    const lootRooms = rooms.filter((r) => r !== spawnRoom);
    const itemRooms = lootRooms.length ? lootRooms : rooms;
    const reserved = new Set();
    const spawns = [];
    let spawnedGear = false;
    let consumableCount = 0;
    const maxConsumables = 2;
    const effectiveDepth = floorNum + (floorDef.vaultDepthBoost || 0);

    const pickDefId = (forceGear = false) => {
      const wantGear = forceGear || !spawnedGear
        || (consumableCount >= maxConsumables && gearPool.length > 0);
      if (wantGear && gearPool.length > 0) {
        const weighted = gearPool.map((d) => ({ value: d.id, weight: d.spawnWeight || 1 }));
        return this.rng.weightedPick(weighted);
      }
      if (consumablePool.length > 0 && consumableCount < maxConsumables) {
        const weighted = consumablePool.map((d) => ({ value: d.id, weight: d.spawnWeight || 1 }));
        return this.rng.weightedPick(weighted);
      }
      const weighted = eligible.map((d) => ({ value: d.id, weight: d.spawnWeight || 1 }));
      return this.rng.weightedPick(weighted);
    };

    for (let i = 0; i < count; i++) {
      const forceGear = !spawnedGear && (i === count - 1 || (count >= 3 && i === count - 2));
      const room = this.rng.pick(itemRooms);
      const tile = this._randomTileInRoom(floor, room, reserved);
      if (!tile) continue;
      reserved.add(`${tile.x},${tile.y}`);
      const defId = pickDefId(forceGear);
      const baseDef = itemDefs[defId];
      if (baseDef?.slot) spawnedGear = true;
      if (baseDef?.type === 'consumable') consumableCount++;
      const affixes = baseDef?.slot ? rollItemAffixes(baseDef, effectiveDepth, this.rng) : null;
      const entry = { x: tile.x, y: tile.y, defId };
      if (affixes) entry.affixes = affixes;
      spawns.push(entry);
    }
    return spawns;
  }

  /** Forge floors: material piles instead of random gear. */
  _spawnForgeMaterials(floor, rooms, spawnRoom, floorDef, itemDefs) {
    const biomeId = floorDef.biomeId || 'forgotten_crypts';
    const mats = Object.values(itemDefs).filter(
      (d) => d.type === 'material' && Array.isArray(d.biomes) && d.biomes.includes(biomeId)
    );
    if (mats.length === 0) return [];
    const lootRooms = rooms.filter((r) => r !== spawnRoom);
    const itemRooms = lootRooms.length ? lootRooms : rooms;
    const reserved = new Set();
    const spawns = [];
    const pileCount = 3;
    for (let i = 0; i < pileCount; i++) {
      const room = this.rng.pick(itemRooms);
      const tile = this._randomTileInRoom(floor, room, reserved);
      if (!tile) continue;
      reserved.add(`${tile.x},${tile.y}`);
      const def = this.rng.pick(mats);
      spawns.push({ x: tile.x, y: tile.y, defId: def.id, count: 1 + (i === 0 ? 1 : 0) });
    }
    return spawns;
  }

  /**
   * Final floor — single large arena room with the boss centered at the
   * far end and the player spawning at the near end. Skips BSP, stairs,
   * and the corridor pass entirely.
   */
  _generateBossArena(floor, floorDef, itemDefs, enemyDefs) {
    const ROOM_W = Math.min(28, GRID_WIDTH - 4);
    const ROOM_H = Math.min(20, GRID_HEIGHT - 4);
    const rx = Math.floor((GRID_WIDTH - ROOM_W) / 2);
    const ry = Math.floor((GRID_HEIGHT - ROOM_H) / 2);
    for (let y = ry; y < ry + ROOM_H; y++) {
      for (let x = rx; x < rx + ROOM_W; x++) floor.setTile(x, y, TILE.FLOOR);
    }
    floor.rooms = [{ x: rx, y: ry, w: ROOM_W, h: ROOM_H }];
    this._wrapWithWalls(floor);

    // Player at the south middle, boss at the north middle.
    const spawnPoint = { x: rx + Math.floor(ROOM_W / 2), y: ry + ROOM_H - 3 };
    const bossPos    = { x: rx + Math.floor(ROOM_W / 2), y: ry + 2 };
    floor.playerSpawn = spawnPoint;
    floor.stairsUp = spawnPoint;
    // No stairs down — boss must die to end the run.

    const spawns = {
      player: spawnPoint,
      enemies: [],
      items: []
    };
    // The boss itself — if the floor declares one explicitly, use it;
    // otherwise pick the highest-tier enemy in the pool.
    const bossId = floorDef.specialEnemyId
      || floorDef.bossId
      || this._pickBossId(floorDef, enemyDefs);
    if (bossId) spawns.enemies.push({ x: bossPos.x, y: bossPos.y, defId: bossId });

    // Two flanking elites at the corners of the boss row.
    const flankPool = (floorDef.enemyPool || []).filter((id) => id !== bossId);
    if (flankPool.length > 0) {
      const left  = this.rng.pick(flankPool);
      const right = this.rng.pick(flankPool);
      spawns.enemies.push({ x: rx + 3, y: ry + 3, defId: left });
      spawns.enemies.push({ x: rx + ROOM_W - 4, y: ry + 3, defId: right });
    }

    // A small reward pile at the player's spawn side.
    const itemPool = Object.values(itemDefs)
      .filter((d) => d.slot && (d.floorMin ?? 1) <= floor.index + 1);
    for (let i = 0; i < 2 && itemPool.length > 0; i++) {
      const baseDef = this.rng.pick(itemPool);
      const affixes = rollItemAffixes(baseDef, floor.index + 1 + 18, this.rng);
      const entry = {
        x: rx + Math.floor(ROOM_W / 2) - 1 + i * 2,
        y: ry + ROOM_H - 5,
        defId: baseDef.id
      };
      if (affixes) entry.affixes = affixes;
      spawns.items.push(entry);
    }

    return { floor, spawns };
  }

  _pickBossId(floorDef, enemyDefs) {
    const pool = (floorDef.enemyPool || []).map((id) => enemyDefs[id]).filter(Boolean);
    if (pool.length === 0) return null;
    // Prefer "boss_*"-prefixed ids, else the highest-HP enemy.
    const explicit = pool.find((d) => d.id.startsWith('boss_'));
    if (explicit) return explicit.id;
    return pool.slice().sort((a, b) => (b.stats?.hp || 0) - (a.stats?.hp || 0))[0].id;
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

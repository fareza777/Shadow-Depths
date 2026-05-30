/**
 * Places micro-events per floor during dungeon generation.
 */
import { TILE } from '../config/constants.js';
import {
  pickMicroEventKindExcluding,
  eventCountForFloor,
  isGuaranteedMerchantFloor,
  syncFloorMicroEventLegacy,
  roomKey
} from '../gameplay/floorEvents.js';
import { pickHazardType } from '../gameplay/hazards.js';
import { rollItemAffixes } from '../items/itemGenerator.js';

export class FloorEventPlacer {
  constructor(rng, balance) {
    this.rng = rng;
    this.balance = balance;
    this._usedRooms = new Set();
  }

  /**
   * Place multiple events per floor. @returns {string[]} kinds placed
   */
  placeAll(floor, rooms, spawnRoom, floorDef, floorIndex, spawns, enemyDefs, itemDefs) {
    const cfg = this.balance.dungeon || {};
    const target = eventCountForFloor(floorDef, cfg);
    if (target <= 0) return [];

    const candidates = rooms.filter((r) => r !== spawnRoom && !r.arena);
    if (!candidates.length) return [];

    floor.microEvents = [];
    const usedKinds = new Set();
    const floorNumber = floorIndex + 1;

    if (isGuaranteedMerchantFloor(floorNumber, cfg)) {
      this._placeOne('merchant', floor, candidates, spawnRoom, floorDef, floorIndex,
        spawns, enemyDefs, itemDefs, usedKinds);
    }

    let attempts = 0;
    while (floor.microEvents.length < target && attempts < target * 8) {
      attempts++;
      const kind = pickMicroEventKindExcluding(this.rng, floorDef, cfg, usedKinds,
        { force: floor.microEvents.length < target - 1 });
      if (!kind) break;
      this._placeOne(kind, floor, candidates, spawnRoom, floorDef, floorIndex,
        spawns, enemyDefs, itemDefs, usedKinds);
    }

    syncFloorMicroEventLegacy(floor);
    return floor.microEvents.map((e) => e.kind);
  }

  /** @returns {string|null} single event (legacy) */
  place(floor, rooms, spawnRoom, floorDef, floorIndex, spawns, enemyDefs, itemDefs) {
    const kinds = this.placeAll(floor, rooms, spawnRoom, floorDef, floorIndex, spawns, enemyDefs, itemDefs);
    return kinds[0] || null;
  }

  _placeOne(kind, floor, candidates, spawnRoom, floorDef, floorIndex, spawns, enemyDefs, itemDefs, usedKinds) {
    const evt = { kind, used: {} };
    floor.microEvent = evt;
    this._usedRooms = new Set();
    const fn = PLACERS[kind];
    const ok = fn && fn(this, floor, candidates, spawnRoom, floorDef, floorIndex, spawns, enemyDefs, itemDefs);
    floor.microEvent = null;
    if (ok) {
      floor.microEvents.push(evt);
      usedKinds.add(kind);
    }
    return ok;
  }

  _pickRoom(candidates, spawnRoom, preferLarge = false) {
    const pool = candidates.filter((r) => r !== spawnRoom && !this._usedRooms.has(roomKey(r)));
    if (!pool.length) return null;
    if (preferLarge) {
      const larges = pool.filter((r) => r.large);
      if (larges.length) return this.rng.pick(larges);
    }
    return this.rng.pick(pool);
  }

  _reserveRoom(room) {
    if (room) this._usedRooms.add(roomKey(room));
  }

  _randomTileInRoom(floor, room, reserved) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = this.rng.randInt(room.x + 1, room.x + room.w - 2);
      const y = this.rng.randInt(room.y + 1, room.y + room.h - 2);
      const key = `${x},${y}`;
      if (reserved.has(key)) continue;
      const t = floor.tileAt(x, y);
      if (!t || t.type !== TILE.FLOOR || t.hazard) continue;
      return { x, y, tile: t };
    }
    return null;
  }

  _setInteract(floor, x, y, payload) {
    const t = floor.tileAt(x, y);
    if (!t || !t.isWalkable()) return false;
    t.interact = { ...payload, used: false };
    if (floor.microEvent) floor.microEvent.interactPos = { x, y };
    return true;
  }
}

const PLACERS = {
  shrine(placer, floor, candidates, spawnRoom, _fd, _fi, spawns) {
    const room = placer._pickRoom(candidates, spawnRoom);
    if (!room) return false;
    placer._reserveRoom(room);
    const reserved = occupiedSet(spawns);
    const spot = placer._randomTileInRoom(floor, room, reserved);
    if (!spot) return false;
    return placer._setInteract(floor, spot.x, spot.y, { kind: 'shrine', solid: true });
  },

  trap_room(placer, floor, candidates, spawnRoom, _fd, floorIndex, spawns, _ed, itemDefs) {
    const room = placer._pickRoom(candidates, spawnRoom, true);
    if (!room || room.w < 5 || room.h < 5) return false;
    placer._reserveRoom(room);
    room.trapRoom = true;
    floor.microEvent.trapRoomKey = roomKey(room);
    const reserved = occupiedSet(spawns);
    const center = {
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2)
    };
    let traps = 0;
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        if (x === center.x && y === center.y) continue;
        if (placer.rng.chance(0.55)) {
          const t = floor.tileAt(x, y);
          if (!t || t.type !== TILE.FLOOR || reserved.has(`${x},${y}`)) continue;
          t.hazard = {
            type: pickHazardType(placer.rng, floorIndex),
            armed: true,
            revealed: true
          };
          traps++;
        }
      }
    }
    if (traps < 3) return false;
    const floorNum = floorIndex + 1;
    const gearPool = Object.values(itemDefs).filter((d) => d.slot && (d.floorMin ?? 1) <= floorNum);
    if (gearPool.length) {
      const defId = placer.rng.pick(gearPool).id;
      const baseDef = itemDefs[defId];
      const entry = { x: center.x, y: center.y, defId };
      const affixes = baseDef ? rollItemAffixes(baseDef, floorNum + 4, placer.rng) : null;
      if (affixes) entry.affixes = affixes;
      spawns.items.push(entry);
    }
    return true;
  },

  merchant(placer, floor, candidates, spawnRoom, _fd, _fi, spawns) {
    const room = placer._pickRoom(candidates, spawnRoom);
    if (!room) return false;
    placer._reserveRoom(room);
    const spot = placer._randomTileInRoom(floor, room, occupiedSet(spawns));
    if (!spot) return false;
    return placer._setInteract(floor, spot.x, spot.y, { kind: 'merchant', solid: true });
  },

  rest_alcove(placer, floor, candidates, spawnRoom, _fd, _fi, spawns) {
    const room = placer._pickRoom(candidates, spawnRoom);
    if (!room) return false;
    placer._reserveRoom(room);
    const spot = placer._randomTileInRoom(floor, room, occupiedSet(spawns));
    if (!spot) return false;
    return placer._setInteract(floor, spot.x, spot.y, { kind: 'rest_alcove' });
  },

  ambush_gate(placer, floor, candidates, spawnRoom, floorDef, floorIndex, _spawns, enemyDefs) {
    const room = placer._pickRoom(candidates, spawnRoom, true);
    if (!room) return false;
    placer._reserveRoom(room);
    room.ambushGate = true;
    floor.microEvent.ambushRoomKey = roomKey(room);
    const floorNum = floorIndex + 1;
    const pool = (floorDef.enemyPool || []).filter((id) => {
      const def = enemyDefs[id];
      return def && def.spawnWeight !== 0 && (def.floorMin ?? 1) <= floorNum;
    });
    if (!pool.length) return false;
    floor.microEvent.ambushDefs = [];
    const weighted = pool.map((id) => ({ value: id, weight: enemyDefs[id].spawnWeight || 1 }));
    for (let i = 0; i < 2; i++) {
      floor.microEvent.ambushDefs.push(placer.rng.weightedPick(weighted));
    }
    return true;
  },

  elite_patrol(placer, floor, candidates, spawnRoom, floorDef, floorIndex, spawns, enemyDefs) {
    const room = placer._pickRoom(candidates, spawnRoom);
    if (!room) return false;
    placer._reserveRoom(room);
    const reserved = occupiedSet(spawns);
    const spot = placer._randomTileInRoom(floor, room, reserved);
    if (!spot) return false;
    const floorNum = floorIndex + 1;
    const pool = (floorDef.enemyPool || []).filter((id) => {
      const d = enemyDefs[id];
      return d && d.spawnWeight !== 0 && (d.floorMin ?? 1) <= floorNum;
    });
    if (!pool.length) return false;
    const defId = placer.rng.pick(pool);
    spawns.enemies.push({ x: spot.x, y: spot.y, defId, forceElite: true });
    floor.microEvent.elitePatrol = true;
    if (placer.rng.chance(0.6)) {
      const loot = placer._randomTileInRoom(floor, room, reserved);
      if (loot) spawns.items.push({ x: loot.x, y: loot.y, defId: 'health_potion' });
    }
    return true;
  },

  hazard_zone(placer, floor, candidates, spawnRoom, _fd, floorIndex) {
    const room = placer._pickRoom(candidates, spawnRoom, true);
    if (!room || room.w < 4) return false;
    placer._reserveRoom(room);
    const types = floorIndex >= 6 ? ['frost', 'venom', 'flame'] : ['frost', 'spike'];
    const ambient = placer.rng.pick(types);
    room.hazardZone = ambient;
    floor.microEvent.hazardZoneKey = roomKey(room);
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        const t = floor.tileAt(x, y);
        if (t?.type === TILE.FLOOR) t.ambient = { type: ambient };
      }
    }
    return true;
  },

  mystery_chest(placer, floor, candidates, spawnRoom, _fd, _fi, spawns) {
    const room = placer._pickRoom(candidates, spawnRoom);
    if (!room) return false;
    placer._reserveRoom(room);
    const spot = placer._randomTileInRoom(floor, room, occupiedSet(spawns));
    if (!spot) return false;
    return placer._setInteract(floor, spot.x, spot.y, { kind: 'mystery_chest' });
  },

  altar_sacrifice(placer, floor, candidates, spawnRoom, _fd, _fi, spawns) {
    const room = placer._pickRoom(candidates, spawnRoom);
    if (!room) return false;
    placer._reserveRoom(room);
    const spot = placer._randomTileInRoom(floor, room, occupiedSet(spawns));
    if (!spot) return false;
    return placer._setInteract(floor, spot.x, spot.y, { kind: 'altar_sacrifice', solid: true });
  },

  lore_omen(placer, floor, candidates, spawnRoom, _fd, _fi, spawns) {
    const room = placer._pickRoom(candidates, spawnRoom);
    if (!room) return false;
    placer._reserveRoom(room);
    const spot = placer._randomTileInRoom(floor, room, occupiedSet(spawns));
    if (!spot) return false;
    const omenId = placer.rng.pick(['whisper_north', 'ember_blessing', 'warning']);
    return placer._setInteract(floor, spot.x, spot.y, { kind: 'lore_omen', omenId });
  }
};

function occupiedSet(spawns = {}) {
  const s = new Set();
  for (const e of spawns.enemies || []) s.add(`${e.x},${e.y}`);
  for (const it of spawns.items || []) s.add(`${it.x},${it.y}`);
  return s;
}

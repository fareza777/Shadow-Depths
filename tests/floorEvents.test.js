import { describe, it, expect } from 'vitest';
import { pickMicroEventKind, applyFloorModifiersToAtk, EVENT_KINDS } from '../src/gameplay/floorEvents.js';
import { FloorEventPlacer } from '../src/world/FloorEventPlacer.js';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { Floor } from '../src/world/Floor.js';
import { TILE } from '../src/config/constants.js';

function mockRng(seed = 1) {
  let s = seed;
  return {
    chance(p) { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000 < p; },
    pick(arr) { s = (s * 1103515245 + 12345) & 0x7fffffff; return arr[s % arr.length]; },
    randInt(a, b) { s = (s * 1103515245 + 12345) & 0x7fffffff; return a + (s % (b - a + 1)); },
    weightedPick(w) { return w[0]?.value; },
    fork: () => mockRng(s + 7)
  };
}

describe('floorEvents', () => {
  it('skips forge floors', () => {
    const rng = { chance: () => true, pick: (a) => a[0], fork: () => rng };
    expect(pickMicroEventKind(rng, { type: 'forge' })).toBeNull();
  });

  it('can pick an event kind on normal floors', () => {
    const rng = { chance: () => true, pick: (a) => a[0], fork: () => rng };
    const kind = pickMicroEventKind(rng, { enemyCount: 5 });
    expect(EVENT_KINDS).toContain(kind);
  });

  it('applies atk floor modifier', () => {
    const player = { floorModifiers: { atkPct: 0.1, defPenalty: 0, torchBonus: 0, critBonus: 0 } };
    expect(applyFloorModifiersToAtk(10, player)).toBe(11);
  });
});

describe('FloorEventPlacer', () => {
  it('places interact on a carved floor', () => {
    const floor = new Floor(0, { index: 0, enemyPool: ['goblin_scout'], enemyCount: 3 }, 42);
    const room = { x: 5, y: 5, w: 8, h: 7 };
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        floor.setTile(x, y, TILE.FLOOR);
      }
    }
    floor.rooms = [room, { x: 1, y: 1, w: 4, h: 4 }];
    const spawnRoom = floor.rooms[1];
    const rng = mockRng();
    const placer = new FloorEventPlacer(rng, DEFAULT_BALANCE);
    const spawns = { enemies: [], items: [] };
    const kind = placer.place(
      floor, floor.rooms, spawnRoom,
      { index: 0, enemyPool: ['goblin_scout'], enemyCount: 3 },
      0, spawns, { goblin_scout: { id: 'goblin_scout', spawnWeight: 1, floorMin: 1 } },
      { health_potion: { id: 'health_potion', type: 'consumable', floorMin: 1 } }
    );
    expect(kind).toBeTruthy();
    let found = false;
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (floor.tiles[y][x].interact) found = true;
      }
    }
    if (['shrine', 'merchant', 'rest_alcove', 'mystery_chest', 'altar_sacrifice', 'lore_omen'].includes(kind)) {
      expect(found).toBe(true);
    }
  });
});

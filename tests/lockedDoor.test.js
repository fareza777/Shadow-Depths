import { describe, it, expect } from 'vitest';
import { Tile } from '../src/world/Tile.js';
import { TILE } from '../src/config/constants.js';
import { DungeonGenerator } from '../src/world/DungeonGenerator.js';
import { RNG } from '../src/core/RNG.js';
import { DEFAULT_BALANCE } from '../src/config/balance.js';
import { serializeEventTiles, restoreEventTiles } from '../src/gameplay/floorEventRuntime.js';
import { Floor } from '../src/world/Floor.js';
import enemyDefs from '../data/enemies.json' with { type: 'json' };
import itemDefs from '../data/items.json' with { type: 'json' };
import floorDefs from '../data/floors.json' with { type: 'json' };

function door(locked) {
  const t = new Tile(1, 1, TILE.DOOR);
  t.door = { locked };
  return t;
}

const FLOOR_DEF = floorDefs.floors?.[0] || { index: 0, biomeId: 'forgotten_crypts' };

function buildFloor(seed) {
  const gen = new DungeonGenerator(DEFAULT_BALANCE, new RNG(seed, 'gen'));
  return gen.generate(0, { ...FLOOR_DEF, index: 0 }, itemDefs, enemyDefs);
}

describe('locked door tile', () => {
  it('leaves a plain door open, as the secret-cache reveal expects', () => {
    // Revealing a secret wall turns it straight into a DOOR with no lock.
    // That path predates this feature and must keep working.
    const t = new Tile(1, 1, TILE.DOOR);
    expect(t.isWalkable()).toBe(true);
    expect(t.isBlocking()).toBe(false);
    expect(t.blocksSight()).toBe(false);
  });

  it('blocks movement and sight while locked', () => {
    const t = door(true);
    expect(t.isWalkable()).toBe(false);
    expect(t.isBlocking()).toBe(true);
    expect(t.blocksSight()).toBe(true);   // the vault stays a surprise
  });

  it('behaves like any doorway once unlocked', () => {
    const t = door(true);
    t.door.locked = false;
    expect(t.isWalkable()).toBe(true);
    expect(t.isBlocking()).toBe(false);
    expect(t.blocksSight()).toBe(false);
  });

  it('still refuses a tile held by a solid interactable', () => {
    const t = door(false);
    t.interact = { solid: true, used: false };
    expect(t.isWalkable()).toBe(false);
  });
});

describe('locked vault generation', () => {
  it('only ever seals a dead end, never the route to the stairs', () => {
    // The entire safety argument rests on geometry, not on a rule: if a locked
    // door could sit on the critical path, a keybearer dying somewhere
    // unreachable would strand the run. Flood 60 seeded floors with every
    // locked door treated as a permanent wall.
    let vaults = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { floor, spawns } = buildFloor(seed);
      if (!floor.lockedVault) continue;
      vaults++;

      const key = (x, y) => `${x},${y}`;
      const seen = new Set([key(spawns.player.x, spawns.player.y)]);
      const queue = [spawns.player];
      while (queue.length) {
        const { x, y } = queue.pop();
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (seen.has(k)) continue;
          const t = floor.tileAt(nx, ny);
          if (!t || t.isBlocking()) continue;   // isBlocking() covers locked doors
          seen.add(k);
          queue.push({ x: nx, y: ny });
        }
      }
      expect(seen.has(key(floor.stairsDown.x, floor.stairsDown.y))).toBe(true);
      expect(seen.has(key(floor.lockedVault.x, floor.lockedVault.y))).toBe(false);
    }
    expect(vaults).toBeGreaterThan(0);
  });

  it('hands the key to exactly one enemy that already exists', () => {
    let checked = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { floor, spawns } = buildFloor(seed);
      if (!floor.lockedVault) continue;
      expect(spawns.enemies.filter((e) => e.carriesKey)).toHaveLength(1);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('never marks a keybearer on a floor without a vault', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { floor, spawns } = buildFloor(seed);
      if (floor.lockedVault) continue;
      expect(spawns.enemies.some((e) => e.carriesKey)).toBe(false);
    }
  });
});

describe('locked door survives a save/load', () => {
  it('does not re-lock a door the player already spent a key on', () => {
    // Floors are rebuilt from their seed on reload, so an unlocked door would
    // come back sealed — with the key already consumed, that is loot lost for
    // good. Worse than a secret wall, which costs nothing to find again.
    const floor = new Floor(0, { index: 0 }, 1);
    floor.setTile(3, 3, TILE.DOOR);
    floor.tiles[3][3].door = { locked: false };

    const saved = serializeEventTiles(floor);

    const reloaded = new Floor(0, { index: 0 }, 1);
    reloaded.setTile(3, 3, TILE.DOOR);
    reloaded.tiles[3][3].door = { locked: true };   // regenerated: sealed again
    restoreEventTiles(reloaded, saved);

    expect(reloaded.tiles[3][3].door.locked).toBe(false);
    expect(reloaded.tiles[3][3].isWalkable()).toBe(true);
  });

  it('keeps an untouched door locked across the same round trip', () => {
    const floor = new Floor(0, { index: 0 }, 1);
    floor.setTile(3, 3, TILE.DOOR);
    floor.tiles[3][3].door = { locked: true };

    const reloaded = new Floor(0, { index: 0 }, 1);
    reloaded.setTile(3, 3, TILE.DOOR);
    restoreEventTiles(reloaded, serializeEventTiles(floor));

    expect(reloaded.tiles[3][3].isWalkable()).toBe(false);
  });
});

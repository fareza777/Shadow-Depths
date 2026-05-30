import { describe, it, expect } from 'vitest';
import { Floor } from '../src/world/Floor.js';
import { TILE } from '../src/config/constants.js';
import { findAdjacentInteract, findInteractAt } from '../src/gameplay/floorEventRuntime.js';

describe('pickup vs shrine priority', () => {
  it('findAdjacentInteract skips player tile', () => {
    const floor = new Floor(0, { index: 0 }, 1);
    floor.setTile(2, 2, TILE.FLOOR);
    floor.setTile(2, 1, TILE.FLOOR);
    floor.tiles[1][2].interact = { kind: 'shrine', used: false };
    expect(findInteractAt(floor, 2, 2)).toBeNull();
    expect(findAdjacentInteract(floor, 2, 2)?.x).toBe(2);
    expect(findAdjacentInteract(floor, 2, 2)?.y).toBe(1);
  });
});

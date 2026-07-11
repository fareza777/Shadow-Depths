import { describe, it, expect } from 'vitest';
import { LightingSystem } from '../src/rendering/LightingSystem.js';
import { Floor } from '../src/world/Floor.js';
import { TILE } from '../src/config/constants.js';

function openFloor() {
  const floor = new Floor(0, { index: 0 }, 123);
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      floor.setTile(x, y, TILE.FLOOR);
    }
  }
  return floor;
}

describe('LightingSystem cache revisions', () => {
  it('does not invalidate static render revision for identical light recomputes', () => {
    const floor = openFloor();
    const lighting = new LightingSystem({ vision: { torchRadius: 5 } });
    const staticRev = floor.renderRevision;

    lighting.compute(floor, { x: 10, y: 10 }, 5);
    expect(floor.renderRevision).toBe(staticRev);
    expect(floor.visibilityRevision).toBe(1);

    lighting.compute(floor, { x: 10, y: 10 }, 5);
    expect(floor.renderRevision).toBe(staticRev);
    expect(floor.visibilityRevision).toBe(1);

    lighting.compute(floor, { x: 11, y: 10 }, 5);
    expect(floor.renderRevision).toBe(staticRev);
    expect(floor.visibilityRevision).toBe(2);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { ChaseBehavior } from '../src/entities/behaviors/ChaseBehavior.js';

describe('ChaseBehavior performance', () => {
  it('uses a cheap greedy step for distant targets instead of A*', () => {
    const behavior = new ChaseBehavior();
    const floor = {
      isPassable: (x, y) => x >= 0 && y >= 0,
      inBounds: (x, y) => x >= 0 && y >= 0,
      tileAt: () => ({ isBlocking: () => false, isWalkable: () => true }),
      entityAt: () => null
    };
    const pathfinding = { findPath: vi.fn() };

    const action = behavior.decideAction(
      { x: 0, y: 0 },
      { floor, player: { x: 20, y: 0 }, pathfinding }
    );

    expect(pathfinding.findPath).not.toHaveBeenCalled();
    expect(action).toEqual({ type: 'move', to: { x: 1, y: 0 } });
  });
});

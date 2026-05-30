import { describe, it, expect } from 'vitest';

/** Top-level keys written by GameScene._saveRun — keep in sync with that method. */
export const RUN_SNAPSHOT_KEYS = [
  'version',
  'savedAt',
  'seed',
  'mode',
  'heroKind',
  'floorIndex',
  'player',
  'floor'
];

function assertRunSnapshot(snapshot) {
  for (const key of RUN_SNAPSHOT_KEYS) {
    if (!(key in snapshot)) {
      throw new Error(`run snapshot missing required field: ${key}`);
    }
  }
}

describe('run snapshot contract', () => {
  it('accepts a complete snapshot including heroKind', () => {
    expect(() => assertRunSnapshot({
      version: 1,
      savedAt: Date.now(),
      seed: 42,
      mode: 'normal',
      heroKind: 'echobinder',
      floorIndex: 2,
      player: { pos: { x: 0, y: 0 }, stats: { hp: 10 } },
      floor: { enemies: [] }
    })).not.toThrow();
  });

  it('rejects snapshots without heroKind (resume would pick wrong hero)', () => {
    expect(() => assertRunSnapshot({
      version: 1,
      savedAt: Date.now(),
      seed: 42,
      mode: 'normal',
      floorIndex: 0,
      player: {},
      floor: {}
    })).toThrow(/heroKind/);
  });
});

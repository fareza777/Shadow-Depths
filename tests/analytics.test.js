import { describe, it, expect } from 'vitest';
import { Analytics } from '../src/persistence/Analytics.js';

function fakeBus() {
  const handlers = new Map();
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
    emit(event, payload) {
      const fs = handlers.get(event) || [];
      for (const fn of fs) fn(payload);
    }
  };
}
function fakeState() { return { state: { meta: {} } }; }

describe('Analytics', () => {
  it('captures level_up via entity:leveledUp', () => {
    const bus = fakeBus();
    const state = fakeState();
    const a = new Analytics({ bus, state });
    bus.emit('entity:leveledUp', { entity: { kind: 'player', level: 5 }, levels: 1 });
    expect(state.state.meta.events.length).toBe(1);
    expect(state.state.meta.events[0].kind).toBe('level_up');
    expect(state.state.meta.events[0].newLevel).toBe(5);
    expect(a.summary().level_up).toBe(1);
  });

  it('captures boss_kill for boss_*-prefixed defs', () => {
    const bus = fakeBus();
    const state = fakeState();
    new Analytics({ bus, state });
    bus.emit('entity:died', { entity: { kind: 'enemy', defId: 'boss_voidchoir' } });
    expect(state.state.meta.events[0].kind).toBe('boss_kill');
  });

  it('captures death for player only', () => {
    const bus = fakeBus();
    const state = fakeState();
    new Analytics({ bus, state });
    bus.emit('entity:died', { entity: { kind: 'enemy', defId: 'goblin' }, killer: null });
    bus.emit('entity:died', { entity: { kind: 'player' }, killer: { name: 'wraith' } });
    const evts = state.state.meta.events;
    expect(evts.some((e) => e.kind === 'death')).toBe(true);
    expect(evts.find((e) => e.kind === 'death').killedBy).toBe('wraith');
  });

  it('ring buffer caps at MAX_EVENTS', () => {
    const bus = fakeBus();
    const state = fakeState();
    const a = new Analytics({ bus, state });
    for (let i = 0; i < 600; i++) {
      a.log('test', { i });
    }
    expect(state.state.meta.events.length).toBe(500);
    // First entry should be from i=100 (oldest 100 dropped)
    expect(state.state.meta.events[0].i).toBeGreaterThanOrEqual(99);
  });

  it('recent(kind) filters and limits', () => {
    const bus = fakeBus();
    const state = fakeState();
    const a = new Analytics({ bus, state });
    for (let i = 0; i < 30; i++) a.log('alpha', { i });
    for (let i = 0; i < 5; i++) a.log('beta', { i });
    expect(a.recent('beta').length).toBe(5);
    expect(a.recent('alpha', 10).length).toBe(10);
  });
});

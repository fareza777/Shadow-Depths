import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAchievementDefs, listAchievements, getAchievement, AchievementEngine
} from '../src/persistence/Achievements.js';

loadAchievementDefs({
  achievements: [
    { id: 'test_kill_1',    trigger: 'enemy_kills', threshold: 1,
      name: 'First Blood', reward: { coins: 5 } },
    { id: 'test_kill_10',   trigger: 'enemy_kills', threshold: 10,
      name: 'Ten Foes', reward: { coins: 25 } },
    { id: 'test_deepest_5', trigger: 'deepest_floor', threshold: 5,
      name: 'Descent V', reward: { coins: 10 } }
  ]
});

function fakeBus() {
  const handlers = new Map();
  const emits = [];
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
    emit(event, payload) {
      emits.push({ event, payload });
      const fs = handlers.get(event) || [];
      for (const fn of fs) fn(payload);
    },
    emits
  };
}
function fakeState() {
  return { state: { meta: { coins: 0 } } };
}

describe('AchievementEngine', () => {
  it('registers built-in achievements', () => {
    expect(listAchievements().length).toBe(3);
    expect(getAchievement('test_kill_1').name).toBe('First Blood');
  });

  it('bumps counter via entity:died event', () => {
    const bus = fakeBus();
    const state = fakeState();
    new AchievementEngine({ bus, state });
    bus.emit('entity:died', { entity: { kind: 'enemy' } });
    expect(state.state.meta.achievementCounters.enemy_kills).toBe(1);
    expect(state.state.meta.achievementsUnlocked).toContain('test_kill_1');
    expect(state.state.meta.coins).toBe(5);   // reward applied
  });

  it('unlocks higher tier when counter reaches it', () => {
    const bus = fakeBus();
    const state = fakeState();
    new AchievementEngine({ bus, state });
    for (let i = 0; i < 10; i++) {
      bus.emit('entity:died', { entity: { kind: 'enemy' } });
    }
    expect(state.state.meta.achievementsUnlocked).toContain('test_kill_10');
    expect(state.state.meta.coins).toBe(5 + 25);
  });

  it('does not double-unlock', () => {
    const bus = fakeBus();
    const state = fakeState();
    new AchievementEngine({ bus, state });
    bus.emit('entity:died', { entity: { kind: 'enemy' } });
    bus.emit('entity:died', { entity: { kind: 'enemy' } });
    const ach = state.state.meta.achievementsUnlocked
      .filter((id) => id === 'test_kill_1');
    expect(ach.length).toBe(1);
  });

  it('deepest_floor uses setMax (max wins)', () => {
    const bus = fakeBus();
    const state = fakeState();
    new AchievementEngine({ bus, state });
    bus.emit('floor:entered', { floorNumber: 3 });
    expect(state.state.meta.achievementCounters.deepest_floor).toBe(3);
    bus.emit('floor:entered', { floorNumber: 1 });
    expect(state.state.meta.achievementCounters.deepest_floor).toBe(3);
    bus.emit('floor:entered', { floorNumber: 7 });
    expect(state.state.meta.achievementCounters.deepest_floor).toBe(7);
    expect(state.state.meta.achievementsUnlocked).toContain('test_deepest_5');
  });

  it('emits achievement:unlocked when unlocked', () => {
    const bus = fakeBus();
    const state = fakeState();
    new AchievementEngine({ bus, state });
    bus.emit('entity:died', { entity: { kind: 'enemy' } });
    const unlockEvents = bus.emits.filter((e) => e.event === 'achievement:unlocked');
    expect(unlockEvents.length).toBe(1);
    expect(unlockEvents[0].payload.id).toBe('test_kill_1');
  });
});

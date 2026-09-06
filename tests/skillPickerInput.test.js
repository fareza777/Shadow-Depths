import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkillPickerUI, OPEN_GRACE_MS } from '../src/ui/SkillPickerUI.js';
import { EventBus } from '../src/core/EventBus.js';

const CONTENT = {
  skills: {
    skills: [
      { id: 'a', name: 'Alpha', rarity: 'common', description: 'a', tags: ['fury'] },
      { id: 'b', name: 'Beta', rarity: 'common', description: 'b', tags: ['ward'] },
      { id: 'c', name: 'Gamma', rarity: 'common', description: 'c', tags: ['hunt'] },
      { id: 'd', name: 'Delta', rarity: 'common', description: 'd', tags: ['arcane'] }
    ]
  }
};

function levelUp(levels = 1) {
  const bus = new EventBus();
  const picker = new SkillPickerUI({ bus, content: CONTENT });
  const player = {
    kind: 'player', skills: [], heroKind: 'vigil',
    applySkill(id) { this.skills.push(id); },
    setSynergyMods() {}
  };
  bus.emit('entity:leveledUp', { entity: player, levels });
  return { bus, picker, player };
}

describe('skill picker no longer resolves itself', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  afterEach(() => { vi.useRealTimers(); });

  const past = () => vi.setSystemTime(1_000_000 + OPEN_GRACE_MS + 1);

  it('opens with three choices and the first one selected', () => {
    const { picker } = levelUp();
    expect(picker.open).toBe(true);
    expect(picker.choices).toHaveLength(3);
    expect(picker.selected).toBe(0);
  });

  it('a D-pad direction moves the selection instead of picking', () => {
    // This is the reported bug: every direction ran _pickFirstOrHide(), so
    // nudging the D-pad during a fight took skill #1 before it could be read.
    const { picker, player } = levelUp();
    past();
    picker.handleInput({ type: 'move', dx: 1, dy: 0 });
    expect(picker.open).toBe(true);
    expect(picker.selected).toBe(1);
    expect(player.skills).toHaveLength(0);
  });

  it('wraps the selection instead of falling off either end', () => {
    const { picker } = levelUp();
    past();
    picker.handleInput({ type: 'move', dx: -1, dy: 0 });
    expect(picker.selected).toBe(2);
    picker.handleInput({ type: 'move', dx: 1, dy: 0 });
    expect(picker.selected).toBe(0);
  });

  it('only confirm commits the pick, and it takes the selected card', () => {
    const { picker, player } = levelUp();
    past();
    picker.handleInput({ type: 'move', dx: 1, dy: 0 });
    picker.handleInput({ type: 'confirm' });
    expect(player.skills).toEqual([picker.lastPicked]);
    expect(picker.open).toBe(false);
  });

  it('ignores a tap that lands outside every card', () => {
    // Tapping empty space used to pick skill #1.
    const { picker, player } = levelUp();
    past();
    picker.handleCanvasTap(2, 2);
    expect(picker.open).toBe(true);
    expect(player.skills).toHaveLength(0);
  });

  it('swallows resolving input inside the open grace window', () => {
    // The modal drops over the D-pad, so a tap already in flight when the
    // level-up fires must not resolve anything.
    const { picker, player } = levelUp();
    picker.handleInput({ type: 'confirm' });
    expect(picker.open).toBe(true);
    expect(player.skills).toHaveLength(0);
  });

  it('does not burn a free reroll on a stray wait during the grace window', () => {
    const { picker } = levelUp();
    const before = picker.rerollsLeft;
    picker.handleInput({ type: 'wait' });
    expect(picker.rerollsLeft).toBe(before);
  });

  it('rerolls on wait once the window has passed, and never picks', () => {
    const { picker, player } = levelUp();
    past();
    const before = picker.rerollsLeft;
    picker.handleInput({ type: 'wait' });
    expect(picker.rerollsLeft).toBe(before - 1);
    expect(picker.open).toBe(true);
    // Spent rerolls must not fall through to a pick either.
    picker.handleInput({ type: 'wait' });
    expect(player.skills).toHaveLength(0);
    expect(picker.open).toBe(true);
  });

  it('keeps escape as a way out so the modal can never soft-lock', () => {
    const { picker, player } = levelUp();
    past();
    picker.handleInput({ type: 'escape' });
    expect(picker.open).toBe(false);
    expect(player.skills).toHaveLength(1);
  });

  it('re-arms the grace window for each queued level-up', () => {
    const { picker } = levelUp(2);
    past();
    picker.handleInput({ type: 'confirm' });   // resolves the first pick
    expect(picker.open).toBe(true);            // second choice now showing
    picker.handleInput({ type: 'confirm' });   // inside the fresh window
    expect(picker.open).toBe(true);
  });
});

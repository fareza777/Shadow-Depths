/**
 * Affix library — prefix + suffix pools used by the item generator.
 *
 * Each affix declares:
 *   id        — stable identifier (kept in save data so rolled items rehydrate)
 *   name      — display word ("Sharp", "of Thirst")
 *   tier      — 1 (early), 2 (mid), 3 (deep). Floor depth gates which tiers roll.
 *   when      — array of slot/type strings the affix is valid on
 *   statMods? — flat stat bumps merged into the synthesized item def
 *   onHit?    — legacy onHit list (still supported by CombatSystem)
 *   triggers? — new-shape triggers consumed by TriggerSystem
 *
 * 14 prefixes × 14 suffixes × 5 base rarities × ~25 weapons/armor bases
 * gives roughly 5,000 distinct rolled items without touching items.json.
 */

export const PREFIXES = Object.freeze([
  { id: 'sharp',      name: 'Sharp',      tier: 1, when: ['weapon'],
    statMods: { atk: 1 } },
  { id: 'keen',       name: 'Keen',       tier: 2, when: ['weapon'],
    statMods: { atk: 2, dex: 1 } },
  { id: 'merciless',  name: 'Merciless',  tier: 3, when: ['weapon'],
    statMods: { atk: 3, dex: 2 } },
  { id: 'burning',    name: 'Burning',    tier: 2, when: ['weapon'],
    triggers: [{ when: 'onHit', chance: 0.25,
      do: { type: 'applyStatus', status: 'poison', value: 1, duration: 3 } }] },
  { id: 'cursed',     name: 'Cursed',     tier: 3, when: ['weapon'],
    statMods: { atk: 2 },
    triggers: [{ when: 'onCrit', do: { type: 'damage', value: 4 } }] },
  { id: 'reinforced', name: 'Reinforced', tier: 1, when: ['armor', 'helm', 'legs'],
    statMods: { def: 1 } },
  { id: 'guarded',    name: 'Guarded',    tier: 2, when: ['armor', 'helm', 'legs'],
    statMods: { def: 2 } },
  { id: 'bulwark',    name: 'Bulwark',    tier: 3, when: ['armor'],
    statMods: { def: 3 } },
  { id: 'hardy',      name: 'Hardy',      tier: 1, when: ['armor', 'helm', 'ring', 'necklace'],
    statMods: { hpMax: 3 } },
  { id: 'iron',       name: 'Iron',       tier: 2, when: ['armor', 'helm', 'legs'],
    statMods: { def: 1, hpMax: 4 } },
  { id: 'cracked',    name: 'Cracked',    tier: 1, when: ['weapon', 'armor', 'helm'],
    statMods: {} },  // visual-only "found-broken" flavor; sprite tint, no buff
  { id: 'gilded',     name: 'Gilded',     tier: 2, when: ['ring', 'necklace'],
    statMods: { hpMax: 2, dex: 1 } },
  { id: 'arcane',     name: 'Arcane',     tier: 3, when: ['ring', 'necklace', 'helm'],
    statMods: { hpMax: 4 },
    triggers: [{ when: 'onTurnStart', chance: 0.1, do: { type: 'heal', value: 1, target: 'self' } }] },
  { id: 'ember',      name: 'Ember-',     tier: 2, when: ['weapon'],
    triggers: [{ when: 'onKill', chance: 0.5, do: { type: 'heal', value: 1, target: 'self' } }] },
  { id: 'voidtouched',name: 'Voidtouched',tier: 3, when: ['weapon', 'necklace'],
    statMods: { atk: 2 },
    triggers: [{ when: 'onKill', chance: 0.3, do: { type: 'grantXP', value: 5, target: 'self' } }] },
  { id: 'savage',     name: 'Savage',     tier: 2, when: ['weapon'],
    statMods: { atk: 2 },
    triggers: [{ when: 'onCrit', do: { type: 'applyStatus', status: 'bleed', value: 2, duration: 3 } }] },
  { id: 'frostbound', name: 'Frostbound', tier: 2, when: ['weapon'],
    triggers: [{ when: 'onHit', chance: 0.15,
      do: { type: 'applyStatus', status: 'freeze', value: 1, duration: 1 } }] },
  { id: 'pious',      name: 'Pious',      tier: 1, when: ['necklace', 'ring'],
    statMods: { hpMax: 3, def: 1 } },
  { id: 'cunning',    name: 'Cunning',    tier: 2, when: ['ring', 'helm'],
    statMods: { dex: 2 } },
  { id: 'wrathful',   name: 'Wrathful',   tier: 3, when: ['weapon'],
    statMods: { atk: 3 },
    triggers: [{ when: 'onHpBelow', pct: 0.4,
      do: { type: 'applyStatus', status: 'atk_buff', value: 3, duration: 4 } }] },
  { id: 'studded',    name: 'Studded',    tier: 1, when: ['armor', 'legs'],
    statMods: { def: 2 } },
  { id: 'spirit_kissed', name: 'Spirit-Kissed', tier: 3, when: ['necklace', 'armor'],
    statMods: { hpMax: 6 },
    triggers: [{ when: 'onTurnStart', chance: 0.08,
      do: { type: 'heal', value: 2, target: 'self' } }] }
]);

export const SUFFIXES = Object.freeze([
  { id: 'of_thirst',     name: 'of Thirst',     tier: 2, when: ['weapon'],
    onHit: [{ type: 'lifesteal', value: 0.15 }] },
  { id: 'of_deep_thirst',name: 'of Deep Thirst',tier: 3, when: ['weapon'],
    onHit: [{ type: 'lifesteal', value: 0.30 }] },
  { id: 'of_warding',    name: 'of Warding',    tier: 1, when: ['armor', 'helm', 'legs', 'ring'],
    statMods: { def: 1 } },
  { id: 'of_iron_ward',  name: 'of the Iron Ward', tier: 2, when: ['armor', 'helm', 'legs'],
    statMods: { def: 2 } },
  { id: 'of_vigor',      name: 'of Vigor',      tier: 1, when: ['ring', 'necklace', 'armor'],
    statMods: { hpMax: 4 } },
  { id: 'of_great_vigor',name: 'of Great Vigor',tier: 3, when: ['ring', 'necklace', 'armor'],
    statMods: { hpMax: 8 } },
  { id: 'of_fury',       name: 'of Fury',       tier: 3, when: ['weapon'],
    triggers: [{ when: 'onCrit', do: { type: 'damage', value: 5 } }] },
  { id: 'of_swiftness',  name: 'of Swiftness',  tier: 2, when: ['ring', 'legs', 'helm'],
    statMods: { dex: 2 } },
  { id: 'of_haste',      name: 'of Haste',      tier: 3, when: ['ring', 'legs'],
    statMods: { dex: 3 } },
  { id: 'of_the_bear',   name: 'of the Bear',   tier: 2, when: ['armor', 'helm'],
    statMods: { hpMax: 5, def: 1 } },
  { id: 'of_purity',     name: 'of Purity',     tier: 2, when: ['ring', 'necklace'],
    triggers: [{ when: 'onHpBelow', pct: 0.35,
      do: { type: 'heal', value: 4, target: 'self' } }] },
  { id: 'of_executioner',name: 'of the Executioner', tier: 3, when: ['weapon'],
    triggers: [{ when: 'onKill', chance: 0.25, do: { type: 'heal', value: 3, target: 'self' } }] },
  { id: 'of_the_choir',  name: 'of the Choir',  tier: 3, when: ['necklace'],
    statMods: { hpMax: 6, def: 1, dex: 1 } },
  { id: 'of_serpents',   name: 'of Serpents',   tier: 2, when: ['weapon'],
    triggers: [{ when: 'onHit', chance: 0.15,
      do: { type: 'applyStatus', status: 'poison', value: 2, duration: 3 } }] },
  { id: 'of_the_pyre',   name: 'of the Pyre',   tier: 3, when: ['weapon'],
    triggers: [{ when: 'onHit', chance: 0.25,
      do: { type: 'applyStatus', status: 'burn', value: 3, duration: 3 } }] },
  { id: 'of_clemency',   name: 'of Clemency',   tier: 2, when: ['armor', 'helm', 'necklace'],
    triggers: [{ when: 'onHpBelow', pct: 0.25,
      do: { type: 'heal', value: 5, target: 'self' } }] },
  { id: 'of_revenants',  name: 'of Revenants',  tier: 3, when: ['armor'],
    statMods: { def: 2 },
    triggers: [{ when: 'onDamaged', chance: 0.15,
      do: { type: 'applyStatus', status: 'def_buff', value: 2, duration: 3 } }] },
  { id: 'of_the_lash',   name: 'of the Lash',   tier: 2, when: ['weapon'],
    statMods: { atk: 1 },
    triggers: [{ when: 'onHit', chance: 0.2,
      do: { type: 'applyStatus', status: 'slow', value: 1, duration: 2 } }] },
  { id: 'of_the_void',   name: 'of the Void',   tier: 3, when: ['necklace'],
    statMods: { hpMax: 4, atk: 1 },
    triggers: [{ when: 'onKill', chance: 0.2,
      do: { type: 'lifesteal', value: 0.5 } }] },
  { id: 'of_sanctuary',  name: 'of Sanctuary',  tier: 3, when: ['ring', 'necklace'],
    triggers: [{ when: 'onTurnStart', chance: 0.06,
      do: { type: 'heal', value: 3, target: 'self' } }] },
  { id: 'of_iron_will',  name: 'of Iron Will',  tier: 2, when: ['helm', 'necklace'],
    statMods: { def: 1, hpMax: 3 } },
  { id: 'of_the_hunt',   name: 'of the Hunt',   tier: 2, when: ['ring', 'helm'],
    statMods: { dex: 2 },
    triggers: [{ when: 'onKill', chance: 0.4,
      do: { type: 'applyStatus', status: 'atk_buff', value: 1, duration: 3 } }] }
]);

/** Affix-to-display-color (for name tag highlight). */
export const AFFIX_TINT = {
  prefix: '#bcd6ff',
  suffix: '#f0c0a0'
};

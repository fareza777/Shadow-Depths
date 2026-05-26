export const HERO_SPELLS = Object.freeze({
  vigil: {
    name: 'Bulwark',
    cooldown: 7,
    color: '#80b0ff',
    description: 'Heal and raise DEF for a few turns.'
  },
  hollow: {
    name: 'Siphon',
    cooldown: 6,
    range: 6,
    color: '#9a60ff',
    description: 'Drain the nearest visible enemy.'
  },
  inquisitor: {
    name: 'Lantern',
    cooldown: 7,
    range: 6,
    radius: 1,
    color: '#f0b860',
    description: 'Burn a small cluster around a target.'
  },
  reaver: {
    name: 'Bone Storm',
    cooldown: 5,
    radius: 2,
    color: '#e8e0d0',
    description: 'Damage nearby enemies.'
  },
  pilgrim: {
    name: 'Sanctuary',
    cooldown: 8,
    radius: 3,
    color: '#d4be7a',
    description: 'Heal and reveal nearby ground.'
  }
});

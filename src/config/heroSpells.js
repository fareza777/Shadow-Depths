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
  },
  warden: {
    name: 'Iron Stand',
    cooldown: 8,
    color: '#bcd6ff',
    description: 'Apply Iron Skin and brace; nearby attackers slowed.'
  },
  bladedancer: {
    name: 'Echo Strike',
    cooldown: 5,
    range: 2,
    color: '#ff8844',
    description: 'Strike the nearest enemy three times in one turn.'
  },
  echobinder: {
    name: 'Sundering Chord',
    cooldown: 9,
    range: 7,
    radius: 1,
    color: '#c060ff',
    description: 'Sonic burst — damage + freeze in a small radius.'
  }
});

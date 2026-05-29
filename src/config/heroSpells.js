export const HERO_SPELLS = Object.freeze({
  vigil: {
    name: 'Bulwark',
    cooldown: 9,
    color: '#80b0ff',
    description: 'In battle only: modest heal + DEF buff.'
  },
  hollow: {
    name: 'Siphon',
    cooldown: 8,
    range: 5,
    color: '#9a60ff',
    description: 'Drain a foe — capped heal, not a full refill.'
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
    cooldown: 6,
    radius: 2,
    color: '#e8e0d0',
    description: 'AoE damage around you (needs foes in range).'
  },
  pilgrim: {
    name: 'Sanctuary',
    cooldown: 10,
    radius: 3,
    color: '#d4be7a',
    description: 'In battle only: small heal + reveal nearby tiles.'
  },
  warden: {
    name: 'Iron Stand',
    cooldown: 9,
    color: '#bcd6ff',
    description: 'In battle only: Iron Skin; slow nearby foes.'
  },
  bladedancer: {
    name: 'Echo Strike',
    cooldown: 6,
    range: 2,
    color: '#ff8844',
    description: 'Two quick strikes on the nearest foe.'
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

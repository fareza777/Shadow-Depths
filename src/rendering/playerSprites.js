/**
 * Hero sprites — shared body + weapon overlay per equipped weapon type.
 */

export const HERO_HELMET   = '#3e3a48';
export const HERO_HELM_HI  = '#5e5868';
export const HERO_VISOR    = '#0a0810';
export const HERO_EYE      = '#ff5a3a';
export const HERO_ARMOR    = '#5a5468';
export const HERO_ARMOR_HI = '#7a7484';
export const HERO_BELT     = '#1a1820';
export const HERO_PAULDRON = '#7a6a4a';
export const HERO_EMBLEM   = '#d0c050';
export const HERO_LEG      = '#3a3540';
export const HERO_BOOT     = '#161018';
export const HERO_BLADE    = '#d8d8e0';
export const HERO_BLADE_HI = '#ffffff';
export const HERO_HILT     = '#5a3a1e';
export const HERO_GUARD    = '#a07040';
export const HERO_CAPE     = '#7a1a28';
export const HERO_CAPE_HI  = '#a02a30';
export const HERO_WOOD     = '#6a4a28';
export const HERO_STRING   = '#c8b890';
export const HERO_MACE     = '#8a8a94';
export const HERO_MACE_HI  = '#b8b8c8';
export const HERO_MAGIC    = '#9a60ff';

/** Body without weapon — 32×32 design grid. */
export const HERO_BODY = [
  [9, 12, 14, 3, '#54121d'],
  [8, 15, 16, 8, HERO_CAPE],
  [7, 23, 18, 5, '#4a1018'],
  [9, 15, 14, 1, HERO_CAPE_HI],
  [12, 2, 8, 2, HERO_HELM_HI],
  [10, 4, 12, 6, HERO_HELMET],
  [9, 8, 14, 2, HERO_HELM_HI],
  [10, 10, 12, 4, HERO_VISOR],
  [13, 11, 2, 2, HERO_EYE],
  [17, 11, 2, 2, HERO_EYE],
  [14, 14, 4, 1, HERO_HELMET],
  [6, 14, 5, 5, HERO_PAULDRON],
  [21, 14, 5, 5, HERO_PAULDRON],
  [7, 15, 3, 1, '#b09050'],
  [22, 15, 3, 1, '#b09050'],
  [10, 15, 12, 1, HERO_ARMOR_HI],
  [9, 16, 14, 8, HERO_ARMOR],
  [11, 17, 10, 1, HERO_ARMOR_HI],
  [15, 18, 2, 4, HERO_EMBLEM],
  [14, 19, 4, 1, HERO_EMBLEM],
  [10, 23, 12, 2, HERO_BELT],
  [11, 25, 4, 5, HERO_LEG],
  [17, 25, 4, 5, HERO_LEG],
  [10, 30, 6, 2, HERO_BOOT],
  [16, 30, 6, 2, HERO_BOOT]
];

const WEAPON_LAYERS = {
  sword: [
    [24, 5, 3, 20, HERO_BLADE],
    [24, 5, 1, 20, HERO_BLADE_HI],
    [23, 4, 2, 2, HERO_BLADE_HI],
    [21, 24, 8, 2, HERO_GUARD],
    [25, 26, 2, 4, HERO_HILT],
    [24, 30, 4, 1, '#2a180c']
  ],
  bow: [
    [5, 7, 3, 19, HERO_WOOD],
    [4, 10, 1, 13, HERO_STRING],
    [7, 8, 2, 18, '#4a3020'],
    [8, 6, 3, 3, HERO_WOOD],
    [8, 24, 3, 3, HERO_WOOD],
    [10, 13, 13, 1, '#d8c890'],
    [22, 12, 2, 3, HERO_BLADE_HI],
    [18, 11, 2, 5, '#8a7060']
  ],
  crossbow: [
    [18, 15, 12, 3, HERO_WOOD],
    [17, 18, 14, 2, '#3a2818'],
    [28, 13, 3, 6, HERO_MACE],
    [20, 12, 10, 2, HERO_MACE_HI],
    [22, 16, 9, 1, '#d8c890'],
    [24, 20, 2, 4, HERO_HILT]
  ],
  mace: [
    [21, 4, 8, 8, HERO_MACE],
    [22, 5, 6, 6, HERO_MACE_HI],
    [20, 7, 10, 2, '#606070'],
    [24, 12, 3, 15, HERO_HILT],
    [22, 25, 7, 2, HERO_GUARD]
  ],
  dagger: [
    [23, 13, 3, 11, HERO_BLADE],
    [23, 13, 1, 11, HERO_BLADE_HI],
    [22, 12, 2, 2, HERO_BLADE_HI],
    [21, 23, 6, 1, HERO_GUARD],
    [24, 24, 2, 3, HERO_HILT]
  ],
  scythe: [
    [5, 4, 3, 23, HERO_HILT],
    [6, 3, 10, 3, HERO_BLADE],
    [10, 5, 6, 3, HERO_BLADE],
    [13, 7, 3, 4, HERO_BLADE],
    [7, 3, 7, 1, HERO_BLADE_HI],
    [6, 24, 4, 4, HERO_WOOD],
    [11, 7, 2, 2, HERO_MAGIC]
  ],
  axe: [
    [24, 10, 3, 16, HERO_HILT],
    [20, 6, 8, 8, HERO_MACE],
    [21, 7, 6, 6, HERO_MACE_HI],
    [28, 9, 3, 5, '#707080'],
    [22, 24, 8, 2, HERO_GUARD]
  ],
  pick: [
    [23, 8, 3, 19, HERO_HILT],
    [18, 5, 12, 3, HERO_MACE],
    [19, 5, 5, 1, HERO_MACE_HI],
    [28, 6, 2, 4, HERO_BLADE],
    [21, 24, 7, 2, HERO_GUARD]
  ]
};

/**
 * Map equipped weapon item → hero sprite registry key.
 * @param {object|null} weapon
 * @returns {string}
 */
export function resolvePlayerSpriteKey(weapon) {
  if (!weapon) return 'player_sword';
  const k = weapon.spriteKey || weapon.id || '';
  if (/crossbow/i.test(k)) return 'player_crossbow';
  if (/bow|longbow|voidbow/i.test(k)) return 'player_bow';
  if (/boomerang/i.test(k)) return 'player_bow';
  if (/mace|brand/i.test(k)) return 'player_mace';
  if (/dagger|rapier|shard|cleaver/i.test(k)) return 'player_dagger';
  if (/scythe/i.test(k)) return 'player_scythe';
  if (/hatchet|throwaxe|axe/i.test(k)) return 'player_axe';
  if (/pick/i.test(k)) return 'player_pick';
  return 'player_sword';
}

/**
 * @param {(ctx:CanvasRenderingContext2D, x:number, y:number, s:number, pixels:unknown[]) => void} pixelDraw
 */
export function buildPlayerSprites(pixelDraw) {
  const entries = {};
  for (const [variant, layers] of Object.entries(WEAPON_LAYERS)) {
    const key = variant === 'sword' ? 'player_sword' : `player_${variant}`;
    entries[key] = (ctx, x, y, s, opts = {}) => {
      const entity = opts.entity || null;
      drawHeroAura(ctx, x, y, s, variant, entity, opts.time || 0);
      pixelDraw(ctx, x, y, s, heroBodyFor(entity, opts.time || 0));
      pixelDraw(ctx, x, y, s, layers);
      drawEquipmentAccents(ctx, x, y, s, entity, pixelDraw);
    };
  }
  entries.player_idle = entries.player_sword;
  return entries;
}

function heroBodyFor(entity, time) {
  const body = HERO_BODY.slice();
  if (!entity) return body;
  const hpPct = entity.stats?.hpMax ? entity.stats.hp / entity.stats.hpMax : 1;
  if (hpPct < 0.35 && Math.sin(time * 8) > 0) {
    return body.concat([
      [13, 11, 2, 2, '#ff2a2a'],
      [17, 11, 2, 2, '#ff2a2a'],
      [8, 15, 16, 8, '#5a1018']
    ]);
  }
  return body;
}

function drawHeroAura(ctx, x, y, s, variant, entity, time) {
  const colors = {
    bow: '#6ad07c',
    crossbow: '#7aa6e8',
    mace: '#d4be7a',
    dagger: '#e8e0d0',
    scythe: '#c884e8',
    axe: '#e85a4a',
    pick: '#9a8060',
    sword: '#d4be7a'
  };
  const hpPct = entity?.stats?.hpMax ? entity.stats.hp / entity.stats.hpMax : 1;
  const pulse = 0.85 + Math.sin(time * (hpPct < 0.35 ? 8 : 3)) * 0.15;
  ctx.save();
  ctx.globalAlpha = (hpPct < 0.35 ? 0.34 : 0.22) * pulse;
  ctx.fillStyle = colors[variant] || colors.sword;
  ctx.beginPath();
  ctx.ellipse(x + s / 2, y + s * 0.86, s * 0.34, s * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEquipmentAccents(ctx, x, y, s, entity, pixelDraw) {
  if (!entity) return;
  const pixels = [];
  const helm = entity.helm?.spriteKey || '';
  const armor = entity.armor?.spriteKey || '';
  const legs = entity.legs?.spriteKey || '';
  const necklace = entity.necklace?.spriteKey || '';
  const ring = entity.ring?.spriteKey || '';

  if (helm) {
    const col = helm.includes('bone') ? '#d8ccb0'
      : helm.includes('crown') ? HERO_EMBLEM
      : helm.includes('hood') || helm.includes('cloth') ? '#2a2038'
      : '#9a949e';
    pixels.push([10, 3, 12, 2, col], [11, 2, 10, 1, '#ffffff44']);
  }
  if (armor) {
    const col = armor.includes('plate') || armor.includes('scale') ? '#9a98a8'
      : armor.includes('robe') || armor.includes('cloak') ? '#604080'
      : armor.includes('bone') ? '#c8b890'
      : '#7a5a40';
    pixels.push([10, 16, 12, 3, col], [11, 17, 10, 1, '#ffffff33']);
  }
  if (legs) {
    const col = legs.includes('iron') || legs.includes('silver') ? '#8a8a94'
      : legs.includes('crimson') || legs.includes('dark_red') ? '#7a1a28'
      : '#4a4250';
    pixels.push([11, 25, 4, 5, col], [17, 25, 4, 5, col]);
  }
  if (necklace) {
    pixels.push([14, 16, 4, 1, HERO_EMBLEM], [15, 17, 2, 2, '#fff0a0']);
  }
  if (ring) {
    pixels.push([22, 20, 2, 2, ring.includes('speed') ? '#60d080' : HERO_EMBLEM]);
  }
  if (pixels.length) pixelDraw(ctx, x, y, s, pixels);
}

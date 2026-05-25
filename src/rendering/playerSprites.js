/**
 * Hero sprites — shared body + weapon overlay per equipped weapon type.
 */

const HERO_HELMET   = '#3e3a48';
const HERO_HELM_HI  = '#5e5868';
const HERO_VISOR    = '#0a0810';
const HERO_EYE      = '#ff5a3a';
const HERO_ARMOR    = '#5a5468';
const HERO_ARMOR_HI = '#7a7484';
const HERO_BELT     = '#1a1820';
const HERO_PAULDRON = '#7a6a4a';
const HERO_EMBLEM   = '#d0c050';
const HERO_LEG      = '#3a3540';
const HERO_BOOT     = '#161018';
const HERO_BLADE    = '#d8d8e0';
const HERO_BLADE_HI = '#ffffff';
const HERO_HILT     = '#5a3a1e';
const HERO_GUARD    = '#a07040';
const HERO_CAPE     = '#7a1a28';
const HERO_CAPE_HI  = '#a02a30';
const HERO_WOOD     = '#6a4a28';
const HERO_STRING   = '#c8b890';
const HERO_MACE     = '#8a8a94';
const HERO_MACE_HI  = '#b8b8c8';

/** Body without weapon — 32×32 design grid. */
export const HERO_BODY = [
  [10, 14, 12, 2, HERO_CAPE],
  [9, 16, 14, 8, HERO_CAPE],
  [8, 24, 16, 4, HERO_CAPE],
  [10, 16, 12, 1, HERO_CAPE_HI],
  [11, 3, 10, 6, HERO_HELMET],
  [10, 8, 12, 2, HERO_HELM_HI],
  [11, 10, 10, 3, HERO_VISOR],
  [13, 11, 2, 2, HERO_EYE],
  [17, 11, 2, 2, HERO_EYE],
  [14, 13, 4, 1, HERO_HELMET],
  [7, 14, 4, 4, HERO_PAULDRON],
  [21, 14, 4, 4, HERO_PAULDRON],
  [11, 14, 10, 1, HERO_ARMOR_HI],
  [10, 15, 12, 8, HERO_ARMOR],
  [11, 15, 10, 1, HERO_ARMOR_HI],
  [15, 17, 2, 4, HERO_EMBLEM],
  [11, 22, 10, 1, HERO_BELT],
  [11, 23, 4, 6, HERO_LEG],
  [17, 23, 4, 6, HERO_LEG],
  [11, 23, 4, 1, HERO_BELT],
  [17, 23, 4, 1, HERO_BELT],
  [10, 29, 6, 2, HERO_BOOT],
  [16, 29, 6, 2, HERO_BOOT]
];

const WEAPON_LAYERS = {
  sword: [
    [24, 7, 2, 18, HERO_BLADE],
    [24, 7, 1, 18, HERO_BLADE_HI],
    [22, 24, 6, 2, HERO_GUARD],
    [25, 26, 1, 3, HERO_HILT],
    [24, 29, 3, 1, HERO_HILT]
  ],
  bow: [
    [6, 10, 2, 14, HERO_WOOD],
    [5, 12, 1, 10, HERO_STRING],
    [7, 11, 1, 12, '#4a3020'],
    [8, 9, 2, 2, HERO_WOOD],
    [8, 22, 2, 2, HERO_WOOD],
    [9, 14, 1, 6, HERO_STRING],
    [23, 12, 2, 1, '#8a7060']
  ],
  crossbow: [
    [20, 16, 10, 2, HERO_WOOD],
    [19, 17, 12, 1, '#3a2818'],
    [28, 15, 2, 4, HERO_MACE],
    [21, 14, 8, 1, HERO_MACE_HI],
    [24, 18, 1, 3, HERO_HILT]
  ],
  mace: [
    [22, 6, 6, 6, HERO_MACE],
    [23, 7, 4, 4, HERO_MACE_HI],
    [24, 12, 2, 14, HERO_HILT],
    [23, 24, 4, 2, HERO_GUARD]
  ],
  dagger: [
    [23, 14, 2, 10, HERO_BLADE],
    [23, 14, 1, 10, HERO_BLADE_HI],
    [22, 23, 4, 1, HERO_GUARD],
    [24, 24, 2, 2, HERO_HILT]
  ],
  scythe: [
    [4, 6, 3, 3, HERO_MACE],
    [5, 4, 8, 4, HERO_BLADE],
    [6, 4, 6, 1, HERO_BLADE_HI],
    [7, 8, 2, 16, HERO_HILT],
    [8, 22, 2, 4, HERO_WOOD]
  ],
  axe: [
    [22, 8, 5, 5, HERO_MACE],
    [23, 9, 3, 3, HERO_MACE_HI],
    [24, 13, 2, 12, HERO_HILT],
    [23, 24, 4, 2, HERO_GUARD]
  ],
  pick: [
    [21, 5, 4, 4, HERO_MACE],
    [22, 6, 2, 2, HERO_MACE_HI],
    [23, 9, 2, 18, HERO_HILT],
    [22, 6, 2, 3, HERO_BLADE]
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
    entries[key] = (ctx, x, y, s) => {
      pixelDraw(ctx, x, y, s, HERO_BODY);
      pixelDraw(ctx, x, y, s, layers);
    };
  }
  entries.player_idle = entries.player_sword;
  return entries;
}

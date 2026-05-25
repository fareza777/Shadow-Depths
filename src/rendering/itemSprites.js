/**
 * Pixel-art item sprites — registered into SpriteRegistry at boot.
 * Replaces flat magenta fallbacks with detailed procedural icons.
 */
function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h));
}

function strokeRect(ctx, x, y, w, h, color, line = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.strokeRect((x | 0) + 0.5, (y | 0) + 0.5, Math.ceil(w) - 1, Math.ceil(h) - 1);
}

function shade(hex, n) {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + n));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + n));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + n));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function p(ctx, ox, oy, s, pixels) {
  const u = s / 32;
  for (const [px, py, pw, ph, col] of pixels) {
    fillRect(ctx, ox + px * u, oy + py * u, pw * u, ph * u, col);
  }
}

const LIQUID = {
  red: '#c83848', pink: '#e87898', orange: '#d87838', yellow: '#d8c848',
  blue: '#4888d8', dark_blue: '#2848a0', dark_red: '#681818', crimson: '#a01828',
  teal: '#38a8a8', green: '#48b858', dark_green: '#286838', purple: '#8858c8',
  silver: '#c0c8d8', white: '#e8ecf8', grey: '#9098a8', brown: '#8a5830'
};

function potion(ctx, x, y, s, color, large = false) {
  const c = color || LIQUID.red;
  const hi = shade(c, 35);
  const lo = shade(c, -30);
  const glass = '#a8c8e8';
  const cork = '#6a4a28';
  const w = large ? 14 : 12;
  const ox = x + (s - w * (s / 32)) / 2;
  const oy = y + s * 0.12;
  const u = s / 32;
  fillRect(ctx, ox + 4 * u, oy, 6 * u, 3 * u, cork);
  fillRect(ctx, ox + 3 * u, oy + 3 * u, 8 * u, 2 * u, shade(cork, 15));
  fillRect(ctx, ox + 2 * u, oy + 5 * u, 10 * u, (large ? 22 : 18) * u, glass);
  fillRect(ctx, ox + 3 * u, oy + 7 * u, 8 * u, (large ? 16 : 12) * u, c);
  fillRect(ctx, ox + 4 * u, oy + 8 * u, 2 * u, (large ? 12 : 8) * u, hi);
  fillRect(ctx, ox + 8 * u, oy + 10 * u, 2 * u, (large ? 8 : 6) * u, lo);
  fillRect(ctx, ox + 3 * u, oy + 5 * u, 1 * u, (large ? 18 : 14) * u, '#ffffff55');
  strokeRect(ctx, ox + 2 * u, oy + 5 * u, 10 * u, (large ? 20 : 16) * u, '#00000044', 1);
}

function vial(ctx, x, y, s, color) {
  const c = color || LIQUID.green;
  p(ctx, x, y, s, [
    [12, 6, 8, 3, '#5a4030'],
    [11, 9, 10, 14, '#88b8d8'],
    [12, 11, 8, 10, c],
    [13, 12, 2, 6, shade(c, 40)],
    [17, 14, 2, 4, shade(c, -25)],
    [11, 23, 10, 4, '#88b8d8'],
    [14, 25, 4, 2, c]
  ]);
}

function sword(ctx, x, y, s, blade, guard, hilt) {
  p(ctx, x, y, s, [
    [15, 4, 2, 18, blade],
    [14, 4, 1, 18, shade(blade, 50)],
    [16, 6, 1, 14, shade(blade, -20)],
    [11, 21, 10, 2, guard],
    [14, 23, 4, 4, hilt],
    [15, 27, 2, 2, shade(hilt, -20)]
  ]);
}

function dagger(ctx, x, y, s, blade) {
  p(ctx, x, y, s, [
    [15, 8, 2, 12, blade],
    [14, 8, 1, 12, shade(blade, 40)],
    [12, 19, 8, 2, '#8a6838'],
    [14, 21, 4, 5, '#4a3020']
  ]);
}

function mace(ctx, x, y, s) {
  p(ctx, x, y, s, [
    [14, 10, 4, 14, '#5a4030'],
    [11, 4, 10, 8, '#9090a0'],
    [12, 5, 8, 2, '#d0d0e0'],
    [13, 6, 2, 4, '#606068'],
    [17, 6, 2, 4, '#606068']
  ]);
}

function scythe(ctx, x, y, s) {
  p(ctx, x, y, s, [
    [15, 10, 2, 16, '#4a3828'],
    [8, 6, 12, 4, '#a0a8b0'],
    [7, 5, 4, 2, '#d0d8e8'],
    [18, 8, 4, 2, '#707880']
  ]);
}

function armorChest(ctx, x, y, s, main, trim) {
  p(ctx, x, y, s, [
    [10, 10, 12, 14, main],
    [11, 10, 10, 2, trim],
    [12, 12, 8, 8, shade(main, 15)],
    [14, 16, 4, 4, trim],
    [10, 22, 12, 2, shade(main, -25)]
  ]);
}

function scroll(ctx, x, y, s, ribbon) {
  p(ctx, x, y, s, [
    [9, 10, 14, 12, '#d8c890'],
    [10, 11, 12, 10, '#ece0b0'],
    [10, 14, 12, 1, ribbon],
    [10, 17, 12, 1, ribbon],
    [8, 10, 2, 12, '#a09060'],
    [22, 10, 2, 12, '#a09060']
  ]);
}

function bomb(ctx, x, y, s, body, fuse) {
  p(ctx, x, y, s, [
    [14, 6, 4, 4, fuse],
    [13, 5, 2, 2, '#ff8040'],
    [10, 10, 12, 12, body],
    [11, 11, 10, 2, shade(body, 30)],
    [12, 18, 8, 2, shade(body, -25)]
  ]);
}

function crystal(ctx, x, y, s, core) {
  p(ctx, x, y, s, [
    [16, 6, 2, 4, core],
    [12, 10, 8, 4, shade(core, 20)],
    [10, 14, 12, 6, core],
    [12, 20, 8, 4, shade(core, -15)],
    [16, 24, 2, 4, shade(core, -30)],
    [14, 8, 4, 2, '#ffffff88']
  ]);
}

function book(ctx, x, y, s, cover) {
  p(ctx, x, y, s, [
    [10, 9, 12, 14, cover],
    [11, 10, 10, 12, shade(cover, 25)],
    [20, 9, 2, 14, '#1a1018'],
    [12, 12, 8, 1, '#d4be7a'],
    [12, 15, 6, 1, '#d4be7a88']
  ]);
}

function pouch(ctx, x, y, s) {
  p(ctx, x, y, s, [
    [11, 12, 10, 10, '#7a5030'],
    [12, 13, 8, 8, '#9a6840'],
    [13, 10, 6, 3, '#5a3820'],
    [14, 11, 4, 1, '#3a2818']
  ]);
}

function charm(ctx, x, y, s, gem) {
  p(ctx, x, y, s, [
    [14, 8, 4, 14, '#b8a878'],
    [13, 7, 6, 2, '#d8c898'],
    [15, 14, 2, 6, gem],
    [14, 13, 4, 2, shade(gem, 40)]
  ]);
}

/** @returns {Record<string, function>} */
export function buildItemSprites() {
  const out = {};

  for (const [name, col] of Object.entries(LIQUID)) {
    out[`potion_${name}`] = (ctx, x, y, s) => potion(ctx, x, y, s, col, false);
  }
  out.potion_red_large = (ctx, x, y, s) => potion(ctx, x, y, s, LIQUID.red, true);

  out.vial_green = (ctx, x, y, s) => vial(ctx, x, y, s, LIQUID.green);
  out.vial_dark_green = (ctx, x, y, s) => vial(ctx, x, y, s, LIQUID.dark_green);

  out.weapon_sword_iron = (ctx, x, y, s) => sword(ctx, x, y, s, '#b8bcc8', '#8a7a40', '#5a3a20');
  out.weapon_sword_mythril = (ctx, x, y, s) => sword(ctx, x, y, s, '#88e8ff', '#60c0e0', '#3060a0');
  out.weapon_rapier = (ctx, x, y, s) => sword(ctx, x, y, s, '#d0d4e8', '#c0a050', '#4a3020');
  out.weapon_brand = (ctx, x, y, s) => sword(ctx, x, y, s, '#ff6040', '#d04020', '#3a1810');
  out.weapon_cleaver = (ctx, x, y, s) => p(ctx, x, y, s, [
    [10, 14, 12, 4, '#9090a0'], [11, 15, 10, 2, '#c0c0c8'],
    [14, 8, 4, 8, '#707880'], [13, 6, 6, 2, '#a0a8b0'],
    [14, 22, 4, 6, '#4a3020']
  ]);
  out.weapon_dagger_red = (ctx, x, y, s) => dagger(ctx, x, y, s, '#c04050');
  out.weapon_hatchet_bone = (ctx, x, y, s) => p(ctx, x, y, s, [
    [14, 12, 4, 12, '#5a4030'],
    [8, 8, 10, 6, '#e0d8c0'], [9, 9, 8, 2, '#f0ece0'],
    [16, 10, 4, 2, '#a09880']
  ]);
  out.weapon_mace = (ctx, x, y, s) => mace(ctx, x, y, s);
  out.weapon_scythe = (ctx, x, y, s) => scythe(ctx, x, y, s);
  out.weapon_pick = (ctx, x, y, s) => p(ctx, x, y, s, [
    [15, 8, 2, 18, '#6a5030'],
    [8, 4, 10, 6, '#a0a8b8'], [9, 5, 8, 2, '#d0d8e8']
  ]);
  out.weapon_shard = (ctx, x, y, s) => crystal(ctx, x, y, s, '#80d0ff');

  out.armor_padded = (ctx, x, y, s) => armorChest(ctx, x, y, s, '#8a7858', '#6a5840');
  out.armor_leather = (ctx, x, y, s) => armorChest(ctx, x, y, s, '#7a5430', '#5a3a18');
  out.armor_scale = (ctx, x, y, s) => armorChest(ctx, x, y, s, '#5a7068', '#88b0a8');
  out.armor_cloak = (ctx, x, y, s) => p(ctx, x, y, s, [
    [8, 10, 16, 14, '#2a2238'], [10, 12, 12, 10, '#3a3048'],
    [14, 14, 4, 6, '#1a1428'], [12, 8, 8, 3, '#4a3848']
  ]);
  out.armor_plate = (ctx, x, y, s) => armorChest(ctx, x, y, s, '#9098a8', '#d0d4e0');
  out.armor_bone = (ctx, x, y, s) => armorChest(ctx, x, y, s, '#e0d8c0', '#c8b8a0');
  out.armor_robe = (ctx, x, y, s) => p(ctx, x, y, s, [
    [10, 10, 12, 14, '#3a2858'], [12, 12, 8, 10, '#4a3868'],
    [14, 14, 4, 4, '#d4be7a'], [11, 22, 10, 2, '#2a1838']
  ]);

  out.scroll_red = (ctx, x, y, s) => scroll(ctx, x, y, s, '#c04040');
  out.scroll_white = (ctx, x, y, s) => scroll(ctx, x, y, s, '#9090a0');
  out.scroll_yellow = (ctx, x, y, s) => scroll(ctx, x, y, s, '#d0c050');
  out.paper_torn = (ctx, x, y, s) => scroll(ctx, x, y, s, '#a09070');

  out.bomb_grey = (ctx, x, y, s) => bomb(ctx, x, y, s, '#707880', '#3a3020');
  out.bomb_red = (ctx, x, y, s) => bomb(ctx, x, y, s, '#a04040', '#4a2010');
  out.bomb_purple = (ctx, x, y, s) => bomb(ctx, x, y, s, '#7040a0', '#3a1848');
  out.bomb_white = (ctx, x, y, s) => bomb(ctx, x, y, s, '#d0d4e0', '#6a6050');

  out.crystal_pink = (ctx, x, y, s) => crystal(ctx, x, y, s, '#e878a8');
  out.crystal_grey = (ctx, x, y, s) => crystal(ctx, x, y, s, '#9098a8');
  out.crystal_red = (ctx, x, y, s) => crystal(ctx, x, y, s, '#e04050');

  out.book_blue = (ctx, x, y, s) => book(ctx, x, y, s, '#2848a0');
  out.book_black = (ctx, x, y, s) => book(ctx, x, y, s, '#1a1820');

  out.pouch_brown = (ctx, x, y, s) => pouch(ctx, x, y, s);
  out.charm_bone = (ctx, x, y, s) => charm(ctx, x, y, s, '#e8e0d0');
  out.charm_twin = (ctx, x, y, s) => charm(ctx, x, y, s, '#c878a8');
  out.charm_white = (ctx, x, y, s) => charm(ctx, x, y, s, '#f0f0ff');

  return out;
}

export function defaultTintForKey(key) {
  const map = {
    red: '#c04040', pink: '#e890c0', orange: '#d08040', yellow: '#d0c050',
    green: '#5ac06a', teal: '#40a0a0', blue: '#5a8ed8', dark_blue: '#3a5a90',
    dark_green: '#3a7a50', dark_red: '#7a2020', crimson: '#a02020',
    purple: '#9050c0', silver: '#c8c8d0', white: '#e0e0e8',
    grey: '#888892', black: '#202028', bone: '#d6c8a0', brown: '#7a5030',
    twin: '#d8c0d0', torn: '#a09870', iron: '#b8bcc8', mythril: '#88e8ff',
    leather: '#7a5430', padded: '#8a7858', plate: '#9098a8', scale: '#5a7068',
    robe: '#4a3868', cloak: '#3a3048', called: '#d0c050', vigor: '#c87878',
    speed: '#40c080', wards: '#4080d0', tin: '#9090a0', large: null
  };
  for (const word of key.split('_').reverse()) {
    if (map[word]) return map[word];
  }
  if (key.startsWith('weapon_')) return '#c8c8d8';
  if (key.startsWith('potion_') || key.startsWith('vial_')) return '#c84868';
  if (key.startsWith('armor_')) return '#8a8078';
  if (key.startsWith('helm_')) return '#9a94a8';
  if (key.startsWith('legs_')) return '#8a8078';
  if (key.startsWith('necklace_') || key.startsWith('amulet_')) return '#d4be7a';
  if (key.startsWith('ring_')) return '#d4be7a';
  if (key.startsWith('scroll_') || key.startsWith('paper_')) return '#d8c890';
  if (key.startsWith('bomb_')) return '#808890';
  if (key.startsWith('crystal_') || key.startsWith('charm_')) return '#a0b0d0';
  return '#9a8a78';
}

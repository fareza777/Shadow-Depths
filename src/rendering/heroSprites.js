/**
 * Hero sprite atlas — canvas port of hero-sprites.jsx.
 *
 * Five 32×32 hand-painted hero variants. Each registers two sprite keys:
 *   - hero_<kind>       — in-world walking sprite (rendered at TILE_SIZE)
 *   - portrait_<kind>   — same grid scaled larger for Vigil + Select screens
 *
 * The Player carries `heroKind`; SpriteRegistry dispatches the right grid.
 */

// ── Palettes (char → CSS color) ────────────────────────────────────────
const PAL_VIGIL = {
  '0':'#000000','1':'#1c1820','2':'#3a3040','3':'#7a6c84','4':'#7a5c2c',
  '5':'#d4ac6c','6':'#fff2c0','9':'#5a3a20','W':'#cfc2e4','H':'#fff2c0',
  'C':'#5a1a1a','c':'#8a2e2e','D':'#c44438','A':'#2a1808','E':'#ff8844'
};
const PAL_HOLLOW = {
  '0':'#000000','1':'#1a1014','2':'#3a2a30','3':'#5a4828','9':'#3a2a20',
  'b':'#7a6e80','B':'#9a8e9a','W':'#d8d0d8','H':'#f8f4f0','k':'#000000',
  'E':'#9ec8ff','A':'#1a0808'
};
const PAL_INQUIS = {
  '0':'#000000','1':'#0a0810','3':'#2a2230','5':'#3a3340','G':'#7a5c2c',
  'H':'#d4ac6c','k':'#000000','b':'#c8b48a','B':'#9a8868','E':'#ff8844',
  'L':'#5a3a20','A':'#1a1218'
};
const PAL_REAVER = {
  '0':'#000000','3':'#1c1820','W':'#d8cba0','B':'#7a6e54','b':'#5a4e3a',
  'k':'#000000','E':'#c4503a','R':'#5a1a1a','r':'#3a0808','A':'#1a0808'
};
const PAL_PILGRIM = {
  '0':'#000000','3':'#2a1812','5':'#fff2c0','9':'#5a3a20','H':'#d4ac6c',
  'A':'#3a2014','b':'#c8b48a','B':'#9a8868','E':'#ff8844','s':'#5a3a20'
};
const PAL_WARDEN = {
  '0':'#000000','1':'#0a0a14','2':'#1a2a3a','3':'#28394a','4':'#3c5066',
  '5':'#5a7390','6':'#9ab0c8','7':'#cfe0f0','E':'#ff7040','C':'#88a8d4',
  'B':'#506880','A':'#0c0c14'
};
const PAL_BLADE = {
  '0':'#000000','1':'#1a0a10','2':'#3a0e1c','3':'#5a142a','5':'#8a2040',
  '6':'#c84068','7':'#f0a0b8','W':'#f0e0d0','E':'#ff6080','b':'#5a1018',
  'B':'#fffff0','A':'#180206'
};
const PAL_ECHO = {
  '0':'#000000','1':'#0a0418','2':'#180828','3':'#28104a','4':'#3c1a6a',
  '5':'#6c30a8','6':'#a060d8','7':'#d4a8ff','E':'#80f0ff','M':'#ffffff',
  'A':'#0a0410'
};

// ── Grids (32×32 each) ─────────────────────────────────────────────────
const VIGIL = [
  "................................",
  "................................",
  "..............0000..............",
  ".............033330.............",
  "............03333330............",
  "...........0333333330...........",
  "...........03WWWW3W30...........",
  "...........055555550............",
  "..........020EE0EE020...........",
  "..........03WWWWWWWW30..........",
  "..........033333333330..........",
  "...........0099AA9900...........",
  "........033333333333330.........",
  "........0633333333333360........",
  ".......0633WWWWWWWWW3360........",
  ".......063WW55555555WW360.......",
  "......063W5HHHHHHHHHH5W360......",
  "......063W5HHHHHHHHHH5W360......",
  "......063W555555555555W360......",
  "......063WWWWWWWWWWWWWW360......",
  "......0633WWWWWWWWWWWW3360......",
  "......06333WWWWWWWWWW33360......",
  "......0633333WWWWWW333360.......",
  ".....063333333333333333360......",
  ".......0CC99999999999CC0........",
  ".......0CC99999999999CC0........",
  "........0999999999999990........",
  "........0AAA00000000AAA0........",
  "........00AA00....00AA00........",
  "..........00........00..........",
  "................................",
  "................................"
];
const HOLLOW = [
  "................................",
  ".............00000..............",
  "............0bbbbb0.............",
  "...........0bbbbWbb0............",
  "..........0bb000b0bb0...........",
  "..........0bb1Hbb0bb0...........",
  "..........0bbk00bkbb0...........",
  "..........0bbEbbbbbb0...........",
  "..........0bbbbkbbbb0...........",
  "...........0bbbkbbb0............",
  "..........033333333330..........",
  "..........0bbb22222bb0..........",
  "........0WWWb222222bWWW0........",
  ".......0WWbbb22222bbbWW0........",
  "......0WWWbbb22222bbbWWW0.......",
  "......0WWbbbb22222bbbbWW0.......",
  "......0WWbbbb22222bbbbWW0.......",
  "......0WWWbbbb222bbbbWWW0.......",
  "......0WWWWbbbbbbbbWWWWW0.......",
  ".......0WWWWWWWWWWWWWWW0........",
  ".........0WW0WWWWWW0WW0.........",
  ".........0WW000WW000W0..........",
  "...........0bb0..0bb0...........",
  "...........0bb0..0bb0...........",
  "...........0bb0..0bb0...........",
  "...........0AA0..0AA0...........",
  "............00....00............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................"
];
const INQUIS = [
  "................................",
  ".............000000.............",
  "............03333330............",
  "..........033333333G0...........",
  ".........03333333333G0..........",
  ".........03311111133G0..........",
  ".........0331kkkkk13G0..........",
  ".........0331kbbbk13G0..........",
  ".........0331kEbEk13G0..........",
  ".........0331kbbbk13G0..........",
  ".........0331kkkkk13G0..........",
  ".........0G3333333G330..........",
  "........0G33333333333G0.........",
  ".......0G33333G3333333G0........",
  ".......0G3333G533333333G0.......",
  ".......0G3333G5HH333333G0.......",
  ".......0G33333G53333333G0.......",
  ".......0G33333335333333G0.......",
  "......0G3333333333333G3G0.......",
  "......0G3333333333333G3G0.......",
  "......0G33333333333G3333G0......",
  "......0G333333333G33333G0.......",
  "......0G333333333333333G0.......",
  ".......03333333333333330........",
  "........0AAAA00000AAAA0.........",
  ".........0AAA0...0AAA0..........",
  "..........00.......00...........",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................"
];
const REAVER = [
  "................................",
  "............WWWWWWWW............",
  "...........0WWWWWWWW0...........",
  "..........0WWWbbbWWWW0..........",
  ".........0WbbkkkkbbbW0..........",
  ".........0WbEkkkkEbbW0..........",
  ".........0WbbkkkkbbbW0..........",
  ".........0WWbkkkkbbWW0..........",
  ".........0WWWkbbbkWWW0..........",
  "..........0WWBBkkBBWW0..........",
  "...........0BBBBBBBB0...........",
  "..........0WW333333WW0..........",
  "........0WWWb333333bWWW0........",
  ".......0WWWbb333333bbWWW0.......",
  "......0WWWbbb333R33bbbWWW0......",
  "......0WWWbbb33333bbbbWWW0......",
  ".......0WWbbb333333bbWW0........",
  "........0Wbbb333333bbW0.........",
  "........0Wbb33333333bW0.........",
  "........0W33333333333W0.........",
  ".........0333333333330..........",
  ".........0333333333330..........",
  ".........0R3333333333R0.........",
  "........0333333333333330........",
  ".........0AAAA000AAAA0..........",
  "..........0AAA0.0AAA0...........",
  "..........00A0...0A00...........",
  "...........00.....00............",
  "................................",
  "................................",
  "................................",
  "................................"
];
const PILGRIM = [
  "................................",
  "................................",
  "...........0000000000...........",
  ".........0033333333300..........",
  "........0033333333333330........",
  "......03333333H3333333300.......",
  "......03333333HHH333333330......",
  "......03333333H5H333333330......",
  "......03333333HHH333333330......",
  ".....033333333H33333333330......",
  "....00033333333333333333300.....",
  "....0AA000000000000000000AA0....",
  "...........0bbbbbbb0............",
  "...........0bbEbEbb0............",
  "...........0bbbbbbb0............",
  "...........0bb999bb0............",
  "............00999900............",
  "...........099999990............",
  "..........09999999990...........",
  ".........09A9999999A90..........",
  ".........09A9999999A90..........",
  ".........09AA99999AA90..........",
  ".........09AAA999AAA90..........",
  ".........0AAAA999AAAA0..........",
  "..........0AAA999AAA0...........",
  "..........0AAA999AAA0...........",
  "...........0A99999A0............",
  "...........0AA999AA0............",
  "............00000000............",
  "...........0000.0000............",
  "................................",
  "................................"
];

// Warden — heavy tower-shield knight, blue/silver palette, broad shoulders.
const WARDEN = [
  "................................",
  "................................",
  "..............000000............",
  ".............03333330...........",
  "............033444330...........",
  "...........03344544330..........",
  "...........034455554330.........",
  "...........034455554330.........",
  "...........03344EE44330.........",
  "...........03344EE44330.........",
  "...........0334444440...........",
  "...........0334444330...........",
  "..........033333333330..........",
  ".........0344444444430..........",
  ".........044555555544A0.........",
  ".........044566666554A0.........",
  "........0344577777544A0.........",
  "........0344566666544A0.........",
  "........034455555554430.........",
  "........034444444444440.........",
  "........033344444443330.........",
  "........033334444433330.........",
  ".........033344444330...........",
  ".........0333333333330..........",
  "..........0AAA00AAA0............",
  "..........0AAA00AAA0............",
  "...........0AA00AA0.............",
  "...........00....00.............",
  "................................",
  "................................",
  "................................",
  "................................"
];

// Blade Dancer — twin curved blades, red/scarlet sash, lean fast frame.
const BLADE = [
  "................................",
  "................................",
  ".............00000..............",
  "............033333A.............",
  "...........033WWWWA30...........",
  "..........0333EWWE3330..........",
  "..........033bbbbbbb330.........",
  "...........033333333330.........",
  "...........033333333330.........",
  "...........0066666666330........",
  "..........006333333333660.......",
  ".........0BB33333333333BB0......",
  ".........0BB66666666666BB0......",
  ".........0633333333333360.......",
  ".........0633333333333360.......",
  ".........0623333333333260.......",
  ".........0622333333322260.......",
  ".........0666222333322266.......",
  "..........0666622222266660......",
  "...........063366666633360......",
  "...........033366666333330......",
  "............033333333330........",
  "............0AAA000AAA0.........",
  "............0AAA000AAA0.........",
  ".............000....000.........",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................"
];

// Echobinder — magic-focused, deep purple robes, glowing voice/sonic motif.
const ECHO = [
  "................................",
  "................................",
  ".............00000..............",
  "............0444440.............",
  "...........044455440............",
  "..........04455MM55440..........",
  "..........0445EEEEEE440.........",
  "..........0445555555440.........",
  "..........04455MMMM5440.........",
  "..........0445555555440.........",
  "..........00000000000...........",
  "..........0334444443330.........",
  ".........033344444433330........",
  "........0333444444443330........",
  "........0334555555443330........",
  "........033455777755433.........",
  "........0335556667755443........",
  "........0344566666654430........",
  "........0344555555554430........",
  "........0344444444444430........",
  ".........033444444443330........",
  ".........033444444443330........",
  ".........033444444443330........",
  "..........0334444443330.........",
  "..........0AAA000AAA0...........",
  "...........00.....00............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................"
];

// ── Hero defs (sprite + meta + per-hero stat overrides) ────────────────
export const HERO_DEFS = {
  vigil: {
    kind: 'vigil',
    grid: VIGIL, pal: PAL_VIGIL,
    name: 'The Vigil Knight',
    subtitle: 'Last of an order that no longer exists.',
    tags: ['Plate', 'Crimson cape', 'Gold visor'],
    role: 'Tank',
    stats: { hp: 34, atk: 4, def: 5, dex: 2, torchRadius: 5 }
  },
  hollow: {
    kind: 'hollow',
    grid: HOLLOW, pal: PAL_HOLLOW,
    name: 'The Hollow Crusader',
    subtitle: 'His name dropped off somewhere on floor IV.',
    tags: ['Broken helm', 'Tattered cloak', 'One eye'],
    role: 'Bruiser',
    stats: { hp: 26, atk: 5, def: 3, dex: 1, torchRadius: 4 }
  },
  inquisitor: {
    kind: 'inquisitor',
    grid: INQUIS, pal: PAL_INQUIS,
    name: 'The Wandering Inquisitor',
    subtitle: 'She brought her own light. Of course she did.',
    tags: ['Hood', 'Lantern', 'Faith-locked'],
    role: 'Skirmisher',
    stats: { hp: 26, atk: 3, def: 2, dex: 4, torchRadius: 7 }
  },
  reaver: {
    kind: 'reaver',
    grid: REAVER, pal: PAL_REAVER,
    name: 'The Bone Reaver',
    subtitle: 'Wears what is left of better men.',
    tags: ['Skull mask', 'Bone pauldrons', 'Blood pact'],
    role: 'Bruiser',
    stats: { hp: 30, atk: 5, def: 3, dex: 3, torchRadius: 3 }
  },
  pilgrim: {
    kind: 'pilgrim',
    grid: PILGRIM, pal: PAL_PILGRIM,
    name: 'The Ashen Pilgrim',
    subtitle: 'A long walk. One wrong turn.',
    tags: ['Wide-brim hat', 'Travel coat', 'Lantern staff'],
    role: 'Scout',
    stats: { hp: 36, atk: 3, def: 5, dex: 5, torchRadius: 8 }
  },
  warden: {
    kind: 'warden',
    grid: WARDEN, pal: PAL_WARDEN,
    name: 'The Tower Warden',
    subtitle: 'They built the gate. He stayed when the gate failed.',
    tags: ['Tower shield', 'Heavy plate', 'Slow but unbroken'],
    role: 'Tank',
    stats: { hp: 40, atk: 3, def: 7, dex: 1, torchRadius: 4 }
  },
  bladedancer: {
    kind: 'bladedancer',
    grid: BLADE, pal: PAL_BLADE,
    name: 'The Blade Dancer',
    subtitle: 'She named both knives. She will not tell you which.',
    tags: ['Twin daggers', 'Crimson sash', 'Critical strikes'],
    role: 'Skirmisher',
    stats: { hp: 26, atk: 5, def: 2, dex: 6, torchRadius: 5 }
  },
  echobinder: {
    kind: 'echobinder',
    grid: ECHO, pal: PAL_ECHO,
    name: 'The Echobinder',
    subtitle: 'She heard the depths first. Then she answered.',
    tags: ['Voidchoir robe', 'Sonic spell', 'Glass cannon'],
    role: 'Caster',
    stats: { hp: 30, atk: 4, def: 2, dex: 4, torchRadius: 6 }
  }
};

export const HERO_ORDER = ['vigil', 'hollow', 'inquisitor', 'reaver', 'pilgrim', 'warden', 'bladedancer', 'echobinder'];

export function isValidHero(kind) {
  return Object.prototype.hasOwnProperty.call(HERO_DEFS, kind);
}

/**
 * Draw a hero sprite into the canvas at (ox, oy) scaled to `size` px.
 * Crisp pixel art — uses fillRect per cell so any size scales without blur.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} ox
 * @param {number} oy
 * @param {number} size  pixel size of the square sprite output
 * @param {string} kind  one of HERO_ORDER ids
 */
export function drawHeroSprite(ctx, ox, oy, size, kind) {
  const def = HERO_DEFS[kind] || HERO_DEFS.vigil;
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const u = size / cols;
  // Slight overlap (epsilon) avoids 1px seams at certain scales.
  const eps = 0.04;
  for (let y = 0; y < rows; y++) {
    const row = def.grid[y];
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const fill = def.pal[ch];
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(ox + x * u, oy + y * u, u + eps, u + eps);
    }
  }
}

export function heroDef(kind) {
  return HERO_DEFS[kind] || HERO_DEFS.vigil;
}

// ── Equipment overlay (armor / helm / weapon / jewelry) ────────────────
// Painted as vector layers over the Claude-style hero raster. These stay
// intentionally bold at 32px so equipment changes are readable in-world.

const RARITY_TINT = {
  common:   { core: '#9a949e', hi: '#cfc2a4', dark: '#5a5240' },
  uncommon: { core: '#88c656', hi: '#bff0a0', dark: '#3a5818' },
  rare:     { core: '#7faafa', hi: '#bfd6ff', dark: '#2a4a7a' },
  epic:     { core: '#c884e8', hi: '#e8c4ff', dark: '#5a2a7a' },
  legendary:{ core: '#d4ac6c', hi: '#f1d49a', dark: '#7a5c2c' }
};
function tintFor(item) {
  if (!item) return null;
  return RARITY_TINT[item.rarity] || RARITY_TINT.common;
}

function lineW(size, n = 0.9) {
  return Math.max(1, (size / 32) * n);
}

function v(ctx, ox, oy, size, x, y) {
  const u = size / 32;
  return [ox + x * u, oy + y * u];
}

function pxRect(ctx, ox, oy, size, nx, ny, nw, nh, color, stroke = null) {
  const u = size / 32;
  ctx.fillStyle = color;
  ctx.fillRect(ox + nx * u, oy + ny * u, Math.max(1, nw * u + 0.6), Math.max(1, nh * u + 0.6));
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineW(size, 0.55);
    ctx.strokeRect(ox + nx * u, oy + ny * u, Math.max(1, nw * u + 0.6), Math.max(1, nh * u + 0.6));
  }
}

function poly(ctx, ox, oy, size, points, fill, stroke = '#08070c', width = 0.75) {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const [px, py] = v(ctx, ox, oy, size, x, y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineW(size, width);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function line(ctx, ox, oy, size, x1, y1, x2, y2, color, width = 1) {
  const [a, b] = v(ctx, ox, oy, size, x1, y1);
  const [c, d] = v(ctx, ox, oy, size, x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW(size, width);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a, b);
  ctx.lineTo(c, d);
  ctx.stroke();
}

function circle(ctx, ox, oy, size, x, y, r, fill, stroke = '#08070c', width = 0.55) {
  const [cx, cy] = v(ctx, ox, oy, size, x, y);
  const u = size / 32;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1, r * u), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineW(size, width);
    ctx.stroke();
  }
}

function glow(ctx, ox, oy, size, x, y, r, color, alpha = 0.25) {
  const [cx, cy] = v(ctx, ox, oy, size, x, y);
  const u = size / 32;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * u);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Paint equipment accents on top of the hero base grid.
 * Helm  → recolored visor across the top of head
 * Armor → recolored chest plate
 * Weapon→ small held weapon glyph beside the hand
 * Ring  → glint on the hand
 */
export function drawHeroEquipment(ctx, ox, oy, size, entity, time = 0) {
  if (!entity) return;
  const helm = tintFor(entity.helm);
  const armor = tintFor(entity.armor);
  const legs = tintFor(entity.legs);
  const necklace = tintFor(entity.necklace);
  const ring = tintFor(entity.ring);
  const weapon = entity.weapon || null;

  if (armor) drawArmorLayer(ctx, ox, oy, size, entity.armor, armor);
  if (legs) drawLegLayer(ctx, ox, oy, size, entity.legs, legs);
  if (helm) drawHelmLayer(ctx, ox, oy, size, entity.helm, helm);
  if (necklace) drawNecklaceLayer(ctx, ox, oy, size, entity.necklace, necklace, time);
  if (ring) drawRingLayer(ctx, ox, oy, size, ring, time);
  if (weapon) drawHeldWeapon(ctx, ox, oy, size, weapon, time);
}

function drawHelmLayer(ctx, ox, oy, size, item, t) {
  const key = (item.spriteKey || item.id || '').toLowerCase();
  if (/hood|cowl|mask/.test(key)) {
    poly(ctx, ox, oy, size, [[10.4, 5.2], [16, 2.5], [21.6, 5.2], [20.8, 12.5], [11.2, 12.5]], t.dark);
    poly(ctx, ox, oy, size, [[12, 7.2], [16, 5.2], [20, 7.2], [18.9, 11.3], [13.1, 11.3]], '#08070c', null);
    line(ctx, ox, oy, size, 11.2, 5.9, 16, 3.4, t.hi, 0.45);
    return;
  }
  poly(ctx, ox, oy, size, [[10.4, 5.1], [16, 2.7], [21.6, 5.1], [21, 12.2], [11, 12.2]], t.core);
  poly(ctx, ox, oy, size, [[11, 7.2], [21, 7.2], [20.5, 9.8], [11.5, 9.8]], '#08070c', null);
  line(ctx, ox, oy, size, 12.2, 5.6, 19.8, 5.6, t.hi, 0.65);
  line(ctx, ox, oy, size, 16, 3.5, 16, 12, t.hi, 0.55);
  if (/great|horn|crown|circlet/.test(key)) {
    poly(ctx, ox, oy, size, [[11.2, 5.2], [12.4, 2.8], [13.4, 5.2]], t.hi);
    poly(ctx, ox, oy, size, [[18.6, 5.2], [19.6, 2.8], [20.8, 5.2]], t.hi);
  }
}

function drawArmorLayer(ctx, ox, oy, size, item, t) {
  const key = (item.spriteKey || item.id || '').toLowerCase();
  if (/robe|cloth/.test(key)) {
    poly(ctx, ox, oy, size, [[10, 13.2], [22, 13.2], [23.3, 30.5], [8.7, 30.5]], t.core);
    poly(ctx, ox, oy, size, [[10, 13.2], [16, 13.2], [15, 30.5], [8.7, 30.5]], t.dark, null);
    line(ctx, ox, oy, size, 16, 14, 16, 29.7, t.hi, 0.45);
    return;
  }
  if (/leather|ranger|hide/.test(key)) {
    poly(ctx, ox, oy, size, [[9.8, 13], [22.2, 13], [21, 24.5], [11, 24.5]], t.dark);
    poly(ctx, ox, oy, size, [[11.2, 14], [20.8, 14], [19.8, 23.2], [12.2, 23.2]], t.core);
    line(ctx, ox, oy, size, 11.2, 15.2, 20.5, 22.2, t.hi, 0.45);
    line(ctx, ox, oy, size, 20.8, 15.2, 11.5, 22.2, '#08070c', 0.45);
    return;
  }
  poly(ctx, ox, oy, size, [[9.2, 13], [22.8, 13], [21.4, 24.3], [10.6, 24.3]], t.core);
  poly(ctx, ox, oy, size, [[9.2, 13], [16, 13], [15.3, 24.3], [10.6, 24.3]], t.dark, null);
  line(ctx, ox, oy, size, 11.4, 15, 20.6, 15, t.hi, 0.55);
  line(ctx, ox, oy, size, 16, 13.7, 16, 23.7, t.hi, 0.45);
  circle(ctx, ox, oy, size, 16, 20.8, 1.2, t.hi, '#08070c', 0.45);
}

function drawLegLayer(ctx, ox, oy, size, item, t) {
  const key = (item.spriteKey || item.id || '').toLowerCase();
  const accent = /boot|greave|plate|iron/.test(key) ? t.hi : t.core;
  poly(ctx, ox, oy, size, [[11.6, 23], [15.3, 23], [15, 30.2], [11.2, 30.2]], t.dark);
  poly(ctx, ox, oy, size, [[16.7, 23], [20.4, 23], [20.8, 30.2], [17, 30.2]], t.dark);
  line(ctx, ox, oy, size, 12.7, 24.1, 12.5, 29.2, accent, 0.5);
  line(ctx, ox, oy, size, 18, 24.1, 18.2, 29.2, accent, 0.5);
  pxRect(ctx, ox, oy, size, 10.8, 28.5, 4.8, 1.8, t.core, '#08070c');
  pxRect(ctx, ox, oy, size, 16.5, 28.5, 4.8, 1.8, t.core, '#08070c');
}

function drawNecklaceLayer(ctx, ox, oy, size, item, t, time) {
  const pulse = 0.55 + Math.sin(time * 3.2) * 0.2;
  line(ctx, ox, oy, size, 12.7, 13.5, 16, 16.2, t.dark, 0.35);
  line(ctx, ox, oy, size, 19.3, 13.5, 16, 16.2, t.dark, 0.35);
  glow(ctx, ox, oy, size, 16, 16.7, 3.4, t.hi, 0.16 + pulse * 0.12);
  circle(ctx, ox, oy, size, 16, 16.7, 1.1, t.hi, '#08070c', 0.4);
}

function drawRingLayer(ctx, ox, oy, size, t, time) {
  const pulse = 0.5 + Math.sin(time * 5) * 0.25;
  glow(ctx, ox, oy, size, 22.7, 20.1, 2.8, t.hi, 0.18 + pulse * 0.1);
  circle(ctx, ox, oy, size, 22.7, 20.1, 0.75, t.hi, '#08070c', 0.35);
}

function drawHeldWeapon(ctx, ox, oy, size, weapon, time) {
  const key = (weapon.spriteKey || weapon.id || '').toLowerCase();
  const t = tintFor(weapon) || RARITY_TINT.common;
  const wobble = Math.sin(time * 2.3) * 0.4;
  // bow / crossbow → vertical arc string
  if (/bow|crossbow/.test(key)) {
    const [sx, sy] = v(ctx, ox, oy, size, 26.8, 11.3 + wobble);
    const [mx, my] = v(ctx, ox, oy, size, 30.4, 18);
    const [ex, ey] = v(ctx, ox, oy, size, 26.8, 24.7 + wobble);
    ctx.strokeStyle = t.core;
    ctx.lineWidth = lineW(size, 0.9);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    line(ctx, ox, oy, size, 26.8, 11.6 + wobble, 26.8, 24.4 + wobble, t.hi, 0.35);
    line(ctx, ox, oy, size, 24.8, 18.2, 30, 17.5, t.hi, 0.35);
    if (/crossbow/.test(key)) pxRect(ctx, ox, oy, size, 24.5, 16.3, 5.8, 2, t.dark, '#08070c');
    return;
  }
  // staff / scythe → vertical pole + accent at top
  if (/staff|scythe/.test(key)) {
    line(ctx, ox, oy, size, 26.2, 8, 24.5, 26.2, t.dark, 1.2);
    line(ctx, ox, oy, size, 27.1, 8.2, 25.4, 25.8, t.core, 0.55);
    if (/scythe/.test(key)) {
      const [cx, cy] = v(ctx, ox, oy, size, 26.4, 8.7);
      ctx.strokeStyle = t.hi;
      ctx.lineWidth = lineW(size, 0.85);
      ctx.beginPath();
      ctx.arc(cx, cy, (size / 32) * 4, -Math.PI * 0.8, Math.PI * 0.15);
      ctx.stroke();
    } else {
      glow(ctx, ox, oy, size, 26.2, 8.4, 3.6, t.hi, 0.24);
      circle(ctx, ox, oy, size, 26.2, 8.4, 1.4, t.hi);
    }
    return;
  }
  // dagger / axe / mace / sword / default — short blade beside body
  if (/dagger/.test(key)) {
    poly(ctx, ox, oy, size, [[25.3, 13.2], [26.5, 9.5], [27.4, 13.4], [26.3, 20.5]], t.core);
    line(ctx, ox, oy, size, 25.3, 20.2, 28.1, 20.7, t.dark, 0.9);
    return;
  }
  if (/axe|hatchet|cleaver/.test(key)) {
    line(ctx, ox, oy, size, 25.4, 11.5, 25.9, 23.5, '#5a3a20', 1.1);
    if (/cleaver/.test(key)) {
      poly(ctx, ox, oy, size, [[25.8, 10.8], [30.2, 11.5], [29.4, 17.8], [25.8, 17]], t.core);
      line(ctx, ox, oy, size, 27, 11.7, 29.4, 12.1, t.hi, 0.4);
    } else {
      poly(ctx, ox, oy, size, [[26.2, 11.2], [30.5, 12.4], [29.1, 16.5], [26.3, 15.6]], t.core);
      line(ctx, ox, oy, size, 27.1, 12.2, 30, 12.9, t.hi, 0.4);
    }
    return;
  }
  if (/mace|brand/.test(key)) {
    line(ctx, ox, oy, size, 25.4, 13.2, 27, 23.5, '#5a3a20', 1.1);
    circle(ctx, ox, oy, size, 25.2, 10.8, 2.2, t.core);
    line(ctx, ox, oy, size, 23.7, 9.6, 26.7, 9.6, t.hi, 0.4);
    if (/brand/.test(key)) glow(ctx, ox, oy, size, 25.2, 10.8, 4.2, '#ff6040', 0.26);
    return;
  }
  if (/spear|rapier|pick|shard/.test(key)) {
    line(ctx, ox, oy, size, 25.2, 22.7, 28.5, 6.2, t.core, 0.85);
    poly(ctx, ox, oy, size, [[28.5, 4.1], [29.8, 7], [27.3, 6.6]], t.hi);
    line(ctx, ox, oy, size, 24.3, 21.2, 27.2, 21.8, t.dark, 0.75);
    if (/shard/.test(key)) glow(ctx, ox, oy, size, 28.4, 6.5, 4.8, t.hi, 0.25);
    return;
  }
  // default sword
  poly(ctx, ox, oy, size, [[25.4, 20.7], [26.4, 6.5], [27.4, 20.7]], t.core);
  line(ctx, ox, oy, size, 26.4, 7.6, 26.4, 19.7, t.hi, 0.4);
  pxRect(ctx, ox, oy, size, 24.1, 20.4, 4.5, 1.2, t.dark, '#08070c');
  pxRect(ctx, ox, oy, size, 25.6, 21.3, 1.5, 3.2, '#5a3a20', '#08070c');
}

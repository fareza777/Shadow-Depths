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
    stats: { hp: 28, atk: 6, def: 3, dex: 1, torchRadius: 4 }
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
    stats: { hp: 30, atk: 5, def: 4, dex: 3, torchRadius: 3 }
  },
  pilgrim: {
    kind: 'pilgrim',
    grid: PILGRIM, pal: PAL_PILGRIM,
    name: 'The Ashen Pilgrim',
    subtitle: 'A long walk. The wrong shrine.',
    tags: ['Wide-brim hat', 'Travel coat', 'Lantern staff'],
    role: 'Scout',
    stats: { hp: 28, atk: 2, def: 3, dex: 5, torchRadius: 8 }
  },
  warden: {
    kind: 'warden',
    grid: WARDEN, pal: PAL_WARDEN,
    name: 'The Tower Warden',
    subtitle: 'They built the gate. He stayed when the gate failed.',
    tags: ['Tower shield', 'Heavy plate', 'Slow but unbroken'],
    role: 'Tank',
    stats: { hp: 38, atk: 3, def: 7, dex: 1, torchRadius: 4 }
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
    stats: { hp: 24, atk: 4, def: 1, dex: 3, torchRadius: 6 }
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

// ── Equipment overlay (cape / helm / weapon tints) ────────────────────
// Painted on top of the base hero grid using normalized 0-1 coords so the
// same patches scale to any render size. Layers are picked by rarity color
// of the equipped item so upgrades visually read on the avatar.

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

function pxRect(ctx, ox, oy, size, nx, ny, nw, nh, color) {
  const u = size / 32;
  ctx.fillStyle = color;
  ctx.fillRect(ox + nx * u, oy + ny * u, Math.max(1, nw * u + 0.6), Math.max(1, nh * u + 0.6));
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
  const ring = tintFor(entity.ring);
  const weapon = entity.weapon || null;

  // Helm visor band — sits at row 6-8 across the head.
  if (helm) {
    pxRect(ctx, ox, oy, size, 11, 6,  10, 2, helm.core);
    pxRect(ctx, ox, oy, size, 11, 6,  10, 1, helm.hi);
    // Crown studs
    pxRect(ctx, ox, oy, size, 13, 5,   1, 1, helm.hi);
    pxRect(ctx, ox, oy, size, 18, 5,   1, 1, helm.hi);
  }
  // Armor chest plate across rows 13-16.
  if (armor) {
    pxRect(ctx, ox, oy, size, 9,  13, 14, 3, armor.core);
    pxRect(ctx, ox, oy, size, 9,  13, 14, 1, armor.hi);
    pxRect(ctx, ox, oy, size, 15, 14,  2, 2, armor.dark);
  }
  // Ring glint near right hand (row 19).
  if (ring) {
    pxRect(ctx, ox, oy, size, 22, 19,  1, 1, ring.hi);
    pxRect(ctx, ox, oy, size, 22, 20,  1, 1, ring.core);
  }
  // Weapon held to the right of the body, glyph depends on weapon kind.
  if (weapon) {
    drawHeldWeapon(ctx, ox, oy, size, weapon, time);
  }
}

function drawHeldWeapon(ctx, ox, oy, size, weapon, time) {
  const key = (weapon.spriteKey || weapon.id || '').toLowerCase();
  const t = tintFor(weapon) || RARITY_TINT.common;
  const wobble = Math.sin(time * 2.3) * 0.4;
  const u = size / 32;
  // bow / crossbow → vertical arc string
  if (/bow|crossbow/.test(key)) {
    ctx.strokeStyle = t.core;
    ctx.lineWidth = Math.max(1, u * 0.8);
    ctx.beginPath();
    ctx.moveTo(ox + 26 * u, oy + (12 + wobble) * u);
    ctx.quadraticCurveTo(ox + 30 * u, oy + 18 * u, ox + 26 * u, oy + (24 + wobble) * u);
    ctx.stroke();
    ctx.strokeStyle = t.hi;
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(ox + 26 * u, oy + (12 + wobble) * u);
    ctx.lineTo(ox + 26 * u, oy + (24 + wobble) * u);
    ctx.stroke();
    return;
  }
  // staff / scythe → vertical pole + accent at top
  if (/staff|scythe/.test(key)) {
    pxRect(ctx, ox, oy, size, 26, 10, 1, 16, t.dark);
    pxRect(ctx, ox, oy, size, 27, 10, 1, 16, t.core);
    pxRect(ctx, ox, oy, size, 25, 8, 4, 3, t.core);
    pxRect(ctx, ox, oy, size, 25, 8, 4, 1, t.hi);
    return;
  }
  // dagger / axe / mace / sword / default — short blade beside body
  if (/dagger/.test(key)) {
    pxRect(ctx, ox, oy, size, 26, 14, 1, 6, t.core);
    pxRect(ctx, ox, oy, size, 25, 19, 3, 1, t.dark);
    return;
  }
  if (/axe|hatchet/.test(key)) {
    pxRect(ctx, ox, oy, size, 26, 12, 1, 10, '#5a3a20');
    pxRect(ctx, ox, oy, size, 27, 12, 3, 3, t.core);
    pxRect(ctx, ox, oy, size, 27, 12, 3, 1, t.hi);
    return;
  }
  if (/mace|brand/.test(key)) {
    pxRect(ctx, ox, oy, size, 26, 14, 1, 8, '#5a3a20');
    pxRect(ctx, ox, oy, size, 25, 11, 3, 3, t.core);
    pxRect(ctx, ox, oy, size, 25, 11, 3, 1, t.hi);
    return;
  }
  // default sword
  pxRect(ctx, ox, oy, size, 26, 11, 1, 11, t.core);
  pxRect(ctx, ox, oy, size, 26, 11, 1, 2, t.hi);
  pxRect(ctx, ox, oy, size, 25, 21, 3, 1, t.dark);
}

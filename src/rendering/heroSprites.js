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

// ── Hero defs (sprite + meta + per-hero stat overrides) ────────────────
export const HERO_DEFS = {
  vigil: {
    kind: 'vigil',
    grid: VIGIL, pal: PAL_VIGIL,
    name: 'The Vigil Knight',
    subtitle: 'Last of an order that no longer exists.',
    tags: ['Plate', 'Crimson cape', 'Gold visor'],
    stats: { atk: 4, def: 5, dex: 2, torchRadius: 5 }
  },
  hollow: {
    kind: 'hollow',
    grid: HOLLOW, pal: PAL_HOLLOW,
    name: 'The Hollow Crusader',
    subtitle: 'His name dropped off somewhere on floor IV.',
    tags: ['Broken helm', 'Tattered cloak', 'One eye'],
    stats: { atk: 6, def: 3, dex: 1, torchRadius: 4 }
  },
  inquisitor: {
    kind: 'inquisitor',
    grid: INQUIS, pal: PAL_INQUIS,
    name: 'The Wandering Inquisitor',
    subtitle: 'She brought her own light. Of course she did.',
    tags: ['Hood', 'Lantern', 'Faith-locked'],
    stats: { atk: 3, def: 2, dex: 4, torchRadius: 7 }
  },
  reaver: {
    kind: 'reaver',
    grid: REAVER, pal: PAL_REAVER,
    name: 'The Bone Reaver',
    subtitle: 'Wears what is left of better men.',
    tags: ['Skull mask', 'Bone pauldrons', 'Blood pact'],
    stats: { atk: 5, def: 4, dex: 3, torchRadius: 3 }
  },
  pilgrim: {
    kind: 'pilgrim',
    grid: PILGRIM, pal: PAL_PILGRIM,
    name: 'The Ashen Pilgrim',
    subtitle: 'A long walk. The wrong shrine.',
    tags: ['Wide-brim hat', 'Travel coat', 'Lantern staff'],
    stats: { atk: 2, def: 3, dex: 5, torchRadius: 8 }
  }
};

export const HERO_ORDER = ['vigil', 'hollow', 'inquisitor', 'reaver', 'pilgrim'];

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

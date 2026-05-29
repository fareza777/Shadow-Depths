// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Item Art Engine — composable pixel-art item sprites.
//  In-engine port of the item-engine.jsx / item-shapes-*.jsx handoff.
//
//  A spriteKey resolves through SPRITE_MAP → { s:shape, p:palette } and the
//  registered rect-grid for that shape is recoloured by the named palette.
//  Colour variants (16 potions, 16 greaves, 15 necklaces…) reuse ONE grid.
//  Constant materials (wood, gold, steel, cork, leather, gem-sparkle) use
//  fixed symbols; the recolorable body uses 1–5 so a palette swap restyles
//  the whole family. Rendered to SVG then rasterised onto the game canvas.
// ═══════════════════════════════════════════════════════════════════════
import { rasterDraw, rasterPreload } from './spriteRaster.js';

// ---- constant materials (shared across every shape) --------------------
const CONST = {
  '.': 'transparent',
  '0': '#0b0a0f',          // outline / deepest shadow
  'w': '#4a3018', 'W': '#6e4824', 'x': '#8a5e30',   // wood handle (dark→light)
  'k': '#241a10',          // cork / leather dark
  'g': '#9a7438', 'G': '#cda45e', 'Y': '#f0d68a',   // brass/gold (dark→light)
  's': '#5a626c', 'S': '#9aa4b0', 'Q': '#d6dee8',   // steel (dark→mid→light)
  'n': '#2a2630',          // void / iron-dark
  'H': '#fff7e6',          // white specular
  'p': '#c8bda0',          // parchment
  'P': '#e8e0c8',          // parchment light
  'z': '#7a3a2a',          // wax-seal / red leather
  'f': '#d9a441',          // flame / lit
  'F': '#ffe39a',          // flame core
};

// ---- recolorable body palettes (define symbols 1..5) -------------------
const PAL = {
  red:        {1:'#5a0e0e',2:'#8a1a1a',3:'#c4302a',4:'#e8584a',5:'#ff9078'},
  red_large:  {1:'#5a0e0e',2:'#8a1a1a',3:'#c4302a',4:'#e8584a',5:'#ff9078'},
  pink:       {1:'#7a2a4a',2:'#a83a6a',3:'#d85a8a',4:'#f284b0',5:'#ffc0d8'},
  crimson:    {1:'#3e0606',2:'#6e1212',3:'#a02626',4:'#cc4838',5:'#f07a5a'},
  dark_red:   {1:'#2e0606',2:'#560e0e',3:'#841c1c',4:'#aa3028',5:'#cc5040'},
  orange:     {1:'#5a2a08',2:'#8a4810',3:'#c47a20',4:'#e8a840',5:'#ffd070'},
  yellow:     {1:'#5a4a10',2:'#8a7418',3:'#c4a828',4:'#e8d048',5:'#fff088'},
  blue:       {1:'#102a5a',2:'#1e4a8a',3:'#2e6fc4',4:'#58a0e8',5:'#9ad0ff'},
  dark_blue:  {1:'#0a1430',2:'#142450',3:'#243f7a',4:'#3a5ca0',5:'#6a8acc'},
  teal:       {1:'#0a3a38',2:'#147a6a',3:'#22a890',4:'#48d0b8',5:'#92f0d8'},
  green:      {1:'#1a3a0a',2:'#2e6a14',3:'#4a9828',4:'#7ac848',5:'#b4f088'},
  dark_green: {1:'#0e2208',2:'#1a3e12',3:'#2e6020',4:'#488038',5:'#7aa85a'},
  purple:     {1:'#2a0e4a',2:'#481a7a',3:'#6e2eb4',4:'#9858e8',5:'#c694ff'},
  silver:     {1:'#3a4048',2:'#5a626c',3:'#8a929c',4:'#b8c2cc',5:'#eef4fa'},
  grey:       {1:'#26262c',2:'#44444a',3:'#66666e',4:'#9a9aa2',5:'#ccccd4'},
  black:      {1:'#070709',2:'#16161c',3:'#28282f',4:'#46464e',5:'#6e6e76'},
  white:      {1:'#74747e',2:'#9c9ca6',3:'#c6c6d0',4:'#e8e8f0',5:'#ffffff'},
  brown:      {1:'#2a1808',2:'#4a2e14',3:'#6e4820',4:'#94683a',5:'#c0925c'},
  bone:       {1:'#6e6248',2:'#9c8c68',3:'#c4b78e',4:'#e6dcb4',5:'#fff7dc'},
  tin:        {1:'#3a3e44',2:'#5c626a',3:'#868d96',4:'#b2bac2',5:'#e2e8ee'},
  iron:       {1:'#26292f',2:'#43474f',3:'#686f79',4:'#98a0aa',5:'#c6ced6'},
  leather:    {1:'#2e1c0e',2:'#52341a',3:'#7c5026',4:'#a47038',5:'#ca9858'},
  mythril:    {1:'#1a3450',2:'#2e5a8a',3:'#4a8ac4',4:'#80b8e8',5:'#c8ecff'},
  void:       {1:'#160a2a',2:'#2a124a',3:'#451f74',4:'#6a39a8',5:'#9a6ad8'},
  cloth:      {1:'#3a3340',2:'#564b5e',3:'#75677e',4:'#9a8ca2',5:'#c4b8c8'},
  vigor:      {1:'#5a0e0e',2:'#8a1a1a',3:'#c4302a',4:'#e8584a',5:'#ff9078'},
  speed:      {1:'#0a3a38',2:'#147a6a',3:'#22a890',4:'#48d0b8',5:'#92f0d8'},
  wards:      {1:'#102a5a',2:'#1e4a8a',3:'#2e6fc4',4:'#58a0e8',5:'#9ad0ff'},
  called:     {1:'#5a2a08',2:'#8a4810',3:'#c47a20',4:'#e8a840',5:'#ffd070'},
};

// ---- shape registry ----------------------------------------------------
// A shape is a rect-list primitive: { vb, r:[ [x,y,w,h,sym], ... ] } drawn
// back-to-front. `sym` resolves through {...CONST, ...PAL[variant]}.
const SHAPES = {};
const registerShape = (name, shape) => { SHAPES[name] = shape; };

// diagonal run of square cells: start (x,y), n cells stepping (dx,dy), size s
const line = (x, y, n, dx, dy, sym, s) => {
  const a = []; for (let i = 0; i < n; i++) a.push([x + i * dx, y + i * dy, s, s, sym]); return a;
};

// ── consumable & accessory shapes (item-shapes-loot) ───────────────────
registerShape('bottle', { vb: 24, r: [
  [7,9,10,2,'2'], [6,11,12,3,'2'], [6,14,12,4,'3'], [7,18,10,2,'2'], [8,20,8,1,'1'],
  [8,12,8,6,'4'], [9,12,2,6,'5'], [9,12,1,1,'H'],
  [10,6,4,4,'3'], [10,6,1,4,'4'],
  [9,3,6,3,'k'], [9,2,6,1,'W'], [10,3,1,2,'x'],
]});
registerShape('bottle_large', { vb: 24, r: [
  [6,8,12,3,'2'], [5,11,14,4,'2'], [5,15,14,4,'3'], [6,19,12,2,'1'],
  [7,12,10,7,'4'], [9,11,2,9,'5'], [9,11,1,1,'H'],
  [10,5,4,4,'3'], [10,5,1,4,'4'],
  [9,2,6,3,'k'], [9,1,6,1,'W'], [10,2,1,2,'x'],
]});
registerShape('vial', { vb: 24, r: [
  [9,8,6,11,'2'], [9,18,6,2,'1'], [10,20,4,1,'1'],
  [10,9,4,9,'4'], [10,9,1,9,'5'], [11,10,1,1,'H'],
  [9,5,6,1,'S'], [10,6,4,2,'3'],
  [10,3,4,2,'k'], [10,2,4,1,'W'],
]});
registerShape('crystal', { vb: 24, r: [
  [11,3,2,2,'5'], [9,5,6,2,'4'], [8,7,8,3,'3'], [7,10,10,4,'3'],
  [8,14,8,3,'2'], [9,17,6,2,'2'], [10,19,4,2,'1'],
  [10,6,2,8,'5'], [11,5,1,1,'H'], [13,9,2,4,'4'], [8,12,2,3,'2'],
]});
registerShape('bomb', { vb: 24, r: [
  [8,11,10,2,'2'], [7,13,12,5,'2'], [8,18,10,2,'1'],
  [9,12,8,6,'3'], [10,13,3,3,'4'], [10,13,1,1,'H'],
  [11,8,4,3,'s'], [11,8,4,1,'S'],
  [13,5,1,3,'w'], [14,4,1,1,'f'], [15,3,2,2,'F'],
]});
registerShape('pouch', { vb: 24, r: [
  [8,10,9,9,'2'], [9,18,7,2,'1'], [9,11,7,6,'3'], [10,12,3,3,'4'],
  [9,7,7,3,'2'], [10,8,5,2,'4'], [10,7,1,1,'H'],
  [10,4,2,3,'x'], [13,4,2,3,'x'],
]});
registerShape('scroll', { vb: 24, r: [
  [7,7,10,10,'p'], [8,8,8,8,'P'],
  [9,10,5,1,'2'], [9,12,6,1,'2'], [9,14,4,1,'2'],
  [6,5,12,2,'3'], [6,5,12,1,'4'], [6,17,12,2,'2'],
  [11,4,2,16,'z'], [11,4,1,16,'4'],
]});
registerShape('book', { vb: 24, r: [
  [6,4,13,16,'2'], [6,4,13,2,'1'], [6,18,13,2,'1'],
  [7,5,11,14,'3'], [8,5,1,13,'4'],
  [6,4,2,16,'1'], [18,5,1,14,'P'], [19,5,1,14,'p'],
  [11,10,3,4,'G'], [12,11,1,2,'Y'],
]});
registerShape('page', { vb: 24, r: [
  [8,6,9,13,'p'], [9,6,7,13,'P'], [8,6,9,1,'2'], [8,6,1,13,'1'],
  [10,9,5,1,'2'], [10,11,6,1,'2'], [10,13,4,1,'2'], [10,15,5,1,'2'],
  [14,6,3,3,'1'],
]});
registerShape('charm', { vb: 24, r: [
  [11,3,2,4,'x'], [9,4,2,2,'w'], [13,4,2,2,'w'],
  [10,6,4,2,'g'], [10,6,4,1,'G'],
  [9,8,6,7,'3'], [10,15,4,2,'2'], [11,17,2,2,'1'],
  [10,9,3,4,'4'], [10,9,1,1,'H'], [12,11,1,3,'2'],
]});
registerShape('charm_twin', { vb: 24, r: [
  [6,3,2,3,'x'], [16,3,2,3,'x'], [8,4,8,1,'g'],
  [5,6,4,7,'3'], [15,6,4,7,'3'],
  [6,13,2,2,'2'], [16,13,2,2,'2'],
  [6,7,2,4,'4'], [16,7,2,4,'4'], [6,7,1,1,'H'], [16,7,1,1,'H'],
]});
registerShape('ring', { vb: 24, r: [
  [7,11,2,5,'g'], [15,11,2,5,'g'], [8,15,8,2,'g'], [8,16,8,1,'G'], [8,10,8,1,'G'],
  [9,6,6,5,'3'], [10,7,4,3,'4'], [10,6,4,1,'5'], [11,7,1,1,'H'], [10,9,3,1,'2'],
]});
registerShape('necklace', { vb: 24, r: [
  [6,5,2,2,'G'], [7,6,2,2,'g'], [8,8,2,2,'g'], [9,10,2,1,'g'],
  [18,5,2,2,'G'], [17,6,2,2,'g'], [16,8,2,2,'g'], [15,10,2,1,'g'],
  [11,11,4,1,'g'],
  [10,12,5,5,'3'], [11,17,3,2,'2'], [12,19,1,2,'1'],
  [11,13,3,2,'4'], [11,13,1,1,'H'],
]});

// ── weapon / armor / helm / legs shapes (item-shapes-gear) ─────────────
registerShape('sword', { vb: 24, r: [
  [5,19,2,2,'w'], [6,17,2,2,'w'], [4,20,2,2,'G'],
  [6,14,5,2,'g'], [6,14,5,1,'G'],
  ...line(8,13,9,1,-1,'4',2), ...line(8,12,9,1,-1,'5',1), ...line(9,14,8,1,-1,'2',1),
  [16,4,2,2,'5'], [17,3,1,1,'5'],
]});
registerShape('dagger', { vb: 24, r: [
  [7,16,2,3,'w'], [7,19,2,1,'G'], [6,14,5,1,'g'],
  ...line(8,13,6,1,-1,'4',2), ...line(8,12,6,1,-1,'5',1),
  [13,7,2,2,'5'],
]});
registerShape('cleaver', { vb: 24, r: [
  [7,15,2,5,'w'], [7,14,3,1,'g'],
  [9,5,7,10,'3'], [9,5,1,10,'5'], [15,5,1,10,'2'], [9,5,7,1,'4'],
  [10,6,2,3,'4'], [9,14,7,1,'2'],
]});
registerShape('hatchet', { vb: 24, r: [
  [11,5,2,15,'w'], [11,5,1,15,'x'],
  [12,4,4,2,'4'], [12,6,5,3,'3'], [12,9,4,1,'3'],
  [16,5,2,5,'5'], [10,6,2,4,'2'],
]});
registerShape('mace', { vb: 24, r: [
  [11,9,2,11,'w'], [11,9,1,11,'x'],
  [9,3,6,6,'3'], [10,2,4,1,'4'], [10,9,4,1,'2'], [9,3,1,6,'2'], [14,3,1,6,'4'],
  [10,4,2,2,'5'],
  [8,5,1,2,'4'], [15,5,1,2,'4'], [11,1,2,1,'4'], [11,9,2,1,'2'],
]});
registerShape('bow', { vb: 24, r: [
  [11,3,2,2,'3'], [10,5,2,2,'3'], [9,7,2,3,'4'], [9,10,2,4,'4'], [9,14,2,3,'4'],
  [10,17,2,2,'3'], [11,19,2,2,'3'],
  [13,4,1,17,'1'], [11,3,2,1,'5'], [11,20,2,1,'5'], [9,11,2,2,'w'],
]});
registerShape('crossbow', { vb: 24, r: [
  [6,12,12,2,'w'], [6,12,12,1,'x'],
  [16,8,2,9,'3'], [16,8,1,9,'4'], [16,7,2,1,'5'], [16,16,2,1,'5'],
  [15,9,1,7,'1'], [9,14,2,2,'s'], [6,12,1,2,'G'],
]});
registerShape('scythe', { vb: 24, r: [
  ...line(7,18,9,1,-1,'w',2),
  [14,8,3,2,'3'], [11,6,4,2,'4'], [7,5,5,2,'4'], [4,6,4,2,'3'], [3,8,2,3,'2'],
  [5,5,7,1,'5'], [3,10,2,2,'5'],
]});
registerShape('brand', { vb: 24, r: [
  [7,17,2,3,'w'], [6,15,5,1,'g'], [6,15,5,1,'G'],
  ...line(8,14,7,1,-1,'4',2), ...line(8,13,7,1,-1,'5',1),
  [13,5,3,4,'f'], [14,3,2,3,'F'], [14,2,1,1,'F'],
]});
registerShape('pick', { vb: 24, r: [
  [11,8,2,12,'w'], [11,8,1,12,'x'],
  [12,8,6,2,'3'], [17,7,2,2,'4'], [18,8,1,1,'5'], [9,8,3,2,'2'], [11,6,2,2,'g'],
]});
registerShape('shard', { vb: 24, r: [
  [10,16,3,4,'w'], [10,16,1,4,'x'], [9,15,5,1,'g'],
  [11,4,3,11,'3'], [10,7,1,5,'2'], [14,6,1,6,'4'],
  [11,3,2,2,'5'], [12,9,2,3,'5'], [9,9,1,2,'3'], [15,11,1,2,'3'],
]});
registerShape('rapier', { vb: 24, r: [
  [6,17,2,3,'w'], [6,20,2,1,'G'], [7,15,4,2,'g'], [8,14,2,2,'G'],
  ...line(9,14,9,1,-1,'4',1), ...line(9,13,9,1,-1,'5',1), [17,5,1,1,'5'],
]});
registerShape('spear', { vb: 24, r: [
  [11,6,2,15,'w'], [11,6,1,15,'x'],
  [10,2,4,5,'4'], [11,1,2,2,'5'], [10,2,1,5,'5'], [13,3,1,3,'2'], [10,7,4,1,'g'],
]});
registerShape('boomerang', { vb: 24, r: [
  [11,5,3,3,'3'], [11,8,3,3,'3'], [11,11,3,3,'3'], [8,11,3,3,'3'], [5,11,3,3,'3'],
  [11,5,1,9,'4'], [5,12,8,1,'4'], [11,4,3,1,'5'], [4,11,1,3,'5'],
]});
registerShape('helm_dome', { vb: 24, r: [
  [7,6,10,3,'2'], [6,9,12,5,'3'], [7,14,10,2,'2'], [6,8,12,1,'4'],
  [8,11,8,2,'1'], [10,4,4,3,'4'], [11,3,2,1,'5'], [8,9,2,2,'5'],
]});
registerShape('helm_hood', { vb: 24, r: [
  [7,5,10,4,'3'], [6,8,2,8,'3'], [16,8,2,8,'3'], [6,8,12,3,'2'],
  [9,9,6,6,'1'], [10,3,4,3,'4'], [11,2,2,1,'5'], [7,11,1,5,'4'],
]});
registerShape('helm_horned', { vb: 24, r: [
  [7,7,10,7,'3'], [7,7,10,1,'4'], [8,11,8,2,'1'],
  [4,4,2,5,'5'], [3,3,2,2,'5'], [18,4,2,5,'5'], [19,3,2,2,'5'], [8,8,2,2,'5'],
]});
registerShape('helm_crown', { vb: 24, r: [
  [7,12,10,3,'3'], [7,12,10,1,'5'], [7,15,10,1,'2'],
  [7,7,2,5,'3'], [11,6,2,6,'4'], [15,7,2,5,'3'], [9,9,2,3,'3'], [13,9,2,3,'3'],
  [11,5,2,1,'5'], [11,13,2,2,'5'], [8,13,1,1,'H'], [15,13,1,1,'H'],
]});
registerShape('helm_circlet', { vb: 24, r: [
  [6,12,12,2,'3'], [6,12,12,1,'5'], [6,14,12,1,'2'],
  [11,9,2,3,'5'], [11,8,2,1,'H'], [8,11,1,2,'4'], [15,11,1,2,'4'],
]});
registerShape('armor_plate', { vb: 24, r: [
  [7,6,10,3,'2'], [6,9,12,9,'3'], [6,18,12,2,'2'],
  [5,8,3,3,'4'], [16,8,3,3,'4'], [11,9,2,9,'2'], [8,10,2,4,'5'],
  [8,16,1,1,'4'], [15,16,1,1,'4'], [10,5,4,2,'2'],
]});
registerShape('armor_soft', { vb: 24, r: [
  [7,6,10,3,'3'], [7,9,10,9,'3'], [7,18,10,2,'2'],
  [11,9,1,8,'2'], [11,10,2,1,'4'], [11,12,2,1,'4'], [11,14,2,1,'4'],
  [8,10,2,5,'4'], [9,5,6,2,'2'],
]});
registerShape('armor_scale', { vb: 24, r: [
  [6,7,12,11,'2'],
  [7,8,2,2,'4'], [9,8,2,2,'3'], [11,8,2,2,'4'], [13,8,2,2,'3'], [15,8,2,2,'4'],
  [8,10,2,2,'3'], [10,10,2,2,'4'], [12,10,2,2,'3'], [14,10,2,2,'4'],
  [7,12,2,2,'4'], [9,12,2,2,'3'], [11,12,2,2,'4'], [13,12,2,2,'3'], [15,12,2,2,'4'],
  [8,14,2,2,'3'], [10,14,2,2,'4'], [12,14,2,2,'3'], [14,14,2,2,'4'],
  [9,16,2,2,'4'], [11,16,2,2,'3'], [13,16,2,2,'4'], [8,6,8,1,'5'],
]});
registerShape('armor_cloak', { vb: 24, r: [
  [9,4,6,3,'2'], [6,7,12,11,'3'], [6,18,12,2,'2'],
  [9,8,1,10,'2'], [13,8,1,10,'2'], [6,8,1,10,'4'], [11,6,2,2,'G'], [7,8,1,8,'4'],
]});
registerShape('greaves', { vb: 24, r: [
  [7,6,4,12,'3'], [7,18,5,3,'2'], [13,6,4,12,'3'], [13,18,5,3,'2'],
  [7,6,4,2,'4'], [13,6,4,2,'4'], [8,8,1,8,'5'], [14,8,1,8,'5'],
  [7,11,4,1,'2'], [13,11,4,1,'2'], [11,20,1,1,'1'],
]});

// ---- spriteKey → { s:shape, p:palette } --------------------------------
const SPRITE_MAP = {
  // potions
  potion_pink:{s:'bottle',p:'pink'}, potion_red:{s:'bottle',p:'red'},
  potion_red_large:{s:'bottle_large',p:'red'}, potion_crimson:{s:'bottle',p:'crimson'},
  potion_orange:{s:'bottle',p:'orange'}, potion_blue:{s:'bottle',p:'blue'},
  potion_dark_red:{s:'bottle',p:'dark_red'}, potion_dark_blue:{s:'bottle',p:'dark_blue'},
  potion_teal:{s:'bottle',p:'teal'}, potion_silver:{s:'bottle',p:'silver'},
  potion_yellow:{s:'bottle',p:'yellow'}, potion_dark_green:{s:'bottle',p:'dark_green'},
  potion_grey:{s:'bottle',p:'grey'}, potion_black:{s:'bottle',p:'black'},
  potion_white:{s:'bottle',p:'white'}, potion_brown:{s:'bottle',p:'brown'},
  // vials / throwables
  vial_green:{s:'vial',p:'green'}, vial_dark_green:{s:'vial',p:'dark_green'},
  vial_white:{s:'vial',p:'white'}, vial_teal:{s:'vial',p:'teal'}, vial_purple:{s:'vial',p:'purple'},
  // crystals
  crystal_pink:{s:'crystal',p:'pink'}, crystal_grey:{s:'crystal',p:'silver'}, crystal_red:{s:'crystal',p:'red'},
  // bombs
  bomb_grey:{s:'bomb',p:'grey'}, bomb_red:{s:'bomb',p:'red'},
  bomb_purple:{s:'bomb',p:'purple'}, bomb_white:{s:'bomb',p:'white'},
  pouch_brown:{s:'pouch',p:'brown'},
  // scrolls / tomes / pages
  scroll_yellow:{s:'scroll',p:'yellow'}, scroll_white:{s:'scroll',p:'white'}, scroll_red:{s:'scroll',p:'red'},
  book_blue:{s:'book',p:'blue'}, book_black:{s:'book',p:'black'}, paper_torn:{s:'page',p:'bone'},
  // charms
  charm_white:{s:'charm',p:'white'}, charm_bone:{s:'charm',p:'bone'}, charm_twin:{s:'charm_twin',p:'bone'},
  // rings
  ring_tin:{s:'ring',p:'tin'}, ring_bone:{s:'ring',p:'bone'}, ring_vigor:{s:'ring',p:'vigor'},
  ring_speed:{s:'ring',p:'speed'}, ring_wards:{s:'ring',p:'wards'}, ring_called:{s:'ring',p:'called'},
  // necklaces
  necklace_bone:{s:'necklace',p:'bone'}, necklace_tin:{s:'necklace',p:'tin'},
  necklace_orange:{s:'necklace',p:'orange'}, necklace_white:{s:'necklace',p:'white'},
  necklace_silver:{s:'necklace',p:'silver'}, necklace_purple:{s:'necklace',p:'purple'},
  necklace_green:{s:'necklace',p:'green'}, necklace_crimson:{s:'necklace',p:'crimson'},
  necklace_dark_blue:{s:'necklace',p:'dark_blue'}, necklace_grey:{s:'necklace',p:'grey'},
  necklace_teal:{s:'necklace',p:'teal'}, necklace_yellow:{s:'necklace',p:'yellow'},
  necklace_blue:{s:'necklace',p:'blue'}, necklace_black:{s:'necklace',p:'black'},
  necklace_brown:{s:'necklace',p:'brown'},
  // weapons
  weapon_dagger_red:{s:'dagger',p:'red'}, weapon_sword_iron:{s:'sword',p:'iron'},
  weapon_cleaver:{s:'cleaver',p:'iron'}, weapon_hatchet_bone:{s:'hatchet',p:'bone'},
  weapon_mace:{s:'mace',p:'iron'}, weapon_bow:{s:'bow',p:'brown'},
  weapon_scythe:{s:'scythe',p:'iron'}, weapon_brand:{s:'brand',p:'orange'},
  weapon_pick:{s:'pick',p:'iron'}, weapon_shard:{s:'shard',p:'void'},
  weapon_sword_mythril:{s:'sword',p:'mythril'}, weapon_rapier:{s:'rapier',p:'silver'},
  weapon_longbow:{s:'bow',p:'bone'}, weapon_throwaxe:{s:'hatchet',p:'iron'},
  weapon_crossbow:{s:'crossbow',p:'iron'}, weapon_boomerang:{s:'boomerang',p:'bone'},
  weapon_voidbow:{s:'bow',p:'void'}, weapon_spear:{s:'spear',p:'iron'},
  // helms
  helm_leather:{s:'helm_dome',p:'leather'}, helm_iron:{s:'helm_dome',p:'iron'},
  helm_hood:{s:'helm_hood',p:'cloth'}, helm_horned:{s:'helm_horned',p:'iron'},
  helm_crown:{s:'helm_crown',p:'yellow'}, helm_circlet:{s:'helm_circlet',p:'silver'},
  helm_bone:{s:'helm_dome',p:'bone'}, helm_cloth:{s:'helm_hood',p:'brown'},
  // armor
  armor_padded:{s:'armor_soft',p:'brown'}, armor_leather:{s:'armor_soft',p:'leather'},
  armor_scale:{s:'armor_scale',p:'iron'}, armor_cloak:{s:'armor_cloak',p:'cloth'},
  armor_plate:{s:'armor_plate',p:'iron'}, armor_bone:{s:'armor_plate',p:'bone'},
  armor_robe:{s:'armor_cloak',p:'purple'},
  // legs (greaves) — one grid, 16 recolors
  legs_grey:{s:'greaves',p:'grey'}, legs_iron:{s:'greaves',p:'iron'},
  legs_black:{s:'greaves',p:'black'}, legs_green:{s:'greaves',p:'green'},
  legs_brown:{s:'greaves',p:'brown'}, legs_yellow:{s:'greaves',p:'yellow'},
  legs_bone:{s:'greaves',p:'bone'}, legs_purple:{s:'greaves',p:'purple'},
  legs_blue:{s:'greaves',p:'blue'}, legs_white:{s:'greaves',p:'white'},
  legs_orange:{s:'greaves',p:'orange'}, legs_silver:{s:'greaves',p:'silver'},
  legs_teal:{s:'greaves',p:'teal'}, legs_crimson:{s:'greaves',p:'crimson'},
  legs_dark_blue:{s:'greaves',p:'dark_blue'}, legs_dark_red:{s:'greaves',p:'dark_red'},
};

// ═══════════════════════════════════════════════════════════════════════
// SVG builder + canvas rasteriser
// ═══════════════════════════════════════════════════════════════════════
export function itemSpriteSVG(spriteKey, px = 192) {
  const map = SPRITE_MAP[spriteKey];
  if (!map) return '';
  const shape = SHAPES[map.s];
  if (!shape) return '';
  const pal = { ...CONST, ...PAL[map.p] };
  const vb = shape.vb || 24;
  let rects = '';
  for (const [x, y, w, hh, sym] of shape.r) {
    const fill = pal[sym];
    if (!fill || fill === 'transparent') continue;
    rects += `<rect x="${x}" y="${y}" width="${w + 0.02}" height="${hh + 0.02}" fill="${fill}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" `
    + `shape-rendering="crispEdges" width="${px}" height="${px}" `
    + `style="overflow:visible">${rects}</svg>`;
}

export function hasItemArt(spriteKey) { return !!SPRITE_MAP[spriteKey]; }

export function preloadItemArt() {
  for (const key in SPRITE_MAP) rasterPreload('item:' + key, () => itemSpriteSVG(key, 192));
}

/** Draw item `spriteKey` into (x,y) at size×size. Returns false until decoded. */
export function drawVectorItem(ctx, x, y, size, spriteKey) {
  if (!SPRITE_MAP[spriteKey]) return false;
  return rasterDraw(ctx, x, y, size, 'item:' + spriteKey, () => itemSpriteSVG(spriteKey, 192));
}

export { SPRITE_MAP, SHAPES, PAL };

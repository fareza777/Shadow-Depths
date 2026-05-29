/** @jsx __h */
/** @jsxFrag __Frag */
// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · DETAILED SVG item engine.
//  Same illustration style as the enemy/hero engines: ink outlines,
//  multi-tone shading, specular highlights, glow on gems & flames. The
//  palette-recolor model is preserved, so 16 potions / 16 greaves /
//  15 necklaces each share ONE shape.
//
//  In-engine port of the item-art-engine.jsx / item-art-loot.jsx /
//  item-art-gear.jsx handoff. The art code (ICONST, IPAL, ITEM_SPRITE_MAP,
//  every shape fn) is verbatim — only the React runtime is swapped for the
//  h()/Fragment hyperscript (aliased to __h so the shapes' own `h` helper
//  bag doesn't collide with the JSX factory). Each shape fn(p, h) returns
//  markup on a 24×24 viewBox; the result is rasterised onto the game canvas.
// ═══════════════════════════════════════════════════════════════════════
import { h as __h, Fragment as __Frag } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const IINK = '#08070c';

// constant materials shared by every shape
const ICONST = {
  '0': IINK,
  w:'#3c2613', W:'#5a3a1c', x:'#7c5226',                  // wood (dark→light)
  k:'#241a10', K:'#3a2a18',                               // cork / dark leather
  g:'#8a6630', G:'#c79a4e', Y:'#f0d68a', H:'#fff7e6',     // brass/gold + specular
  s:'#525a64', S:'#9aa4b0', Q:'#dde4ee',                  // steel (dark→light)
  p:'#c8bda0', P:'#e8e0c8', z:'#7a2a1e',                  // parchment + wax seal
  f:'#ff7a2a', F:'#ffd86a',                               // flame (body/core)
};

// recolorable body palettes — body symbols 1..5 (dark→light)
const IPAL = {
  red:{1:'#5a0e0e',2:'#8a1a1a',3:'#c4302a',4:'#e8584a',5:'#ff9c84'},
  pink:{1:'#7a2a4a',2:'#a83a6a',3:'#d85a8a',4:'#f284b0',5:'#ffc8de'},
  crimson:{1:'#3e0606',2:'#6e1212',3:'#a02626',4:'#cc4838',5:'#f07a5a'},
  dark_red:{1:'#2e0606',2:'#560e0e',3:'#841c1c',4:'#aa3028',5:'#cc5446'},
  orange:{1:'#5a2a08',2:'#8a4810',3:'#c47a20',4:'#e8a840',5:'#ffd070'},
  yellow:{1:'#5a4a10',2:'#8a7418',3:'#c4a828',4:'#e8d048',5:'#fff088'},
  blue:{1:'#102a5a',2:'#1e4a8a',3:'#2e6fc4',4:'#58a0e8',5:'#9ad0ff'},
  dark_blue:{1:'#0a1430',2:'#142450',3:'#243f7a',4:'#3a5ca0',5:'#6a8acc'},
  teal:{1:'#0a3a38',2:'#147a6a',3:'#22a890',4:'#48d0b8',5:'#92f0d8'},
  green:{1:'#1a3a0a',2:'#2e6a14',3:'#4a9828',4:'#7ac848',5:'#b4f088'},
  dark_green:{1:'#0e2208',2:'#1a3e12',3:'#2e6020',4:'#488038',5:'#7aa85a'},
  purple:{1:'#2a0e4a',2:'#481a7a',3:'#6e2eb4',4:'#9858e8',5:'#c694ff'},
  silver:{1:'#3a4048',2:'#5a626c',3:'#8a929c',4:'#bcc6d2',5:'#eef4fa'},
  grey:{1:'#26262c',2:'#44444a',3:'#66666e',4:'#9a9aa2',5:'#ccccd4'},
  black:{1:'#070709',2:'#16161c',3:'#28282f',4:'#46464e',5:'#74747e'},
  white:{1:'#74747e',2:'#9c9ca6',3:'#c6c6d0',4:'#e8e8f0',5:'#ffffff'},
  brown:{1:'#2a1808',2:'#4a2e14',3:'#6e4820',4:'#94683a',5:'#c0925c'},
  bone:{1:'#6e6248',2:'#9c8c68',3:'#c4b78e',4:'#e6dcb4',5:'#fff7dc'},
  tin:{1:'#3a3e44',2:'#5c626a',3:'#868d96',4:'#b2bac2',5:'#e2e8ee'},
  iron:{1:'#26292f',2:'#43474f',3:'#686f79',4:'#9aa2ac',5:'#cdd5dd'},
  leather:{1:'#2e1c0e',2:'#52341a',3:'#7c5026',4:'#a47038',5:'#caa066'},
  mythril:{1:'#1a3450',2:'#2e5a8a',3:'#4a8ac4',4:'#84bcec',5:'#cdefff'},
  void:{1:'#160a2a',2:'#2a124a',3:'#451f74',4:'#6a39a8',5:'#a878e0'},
  cloth:{1:'#3a3340',2:'#564b5e',3:'#75677e',4:'#9a8ca2',5:'#c4b8c8'},
  vigor:{1:'#5a0e0e',2:'#8a1a1a',3:'#c4302a',4:'#e8584a',5:'#ff9c84'},
  speed:{1:'#0a3a38',2:'#147a6a',3:'#22a890',4:'#48d0b8',5:'#92f0d8'},
  wards:{1:'#102a5a',2:'#1e4a8a',3:'#2e6fc4',4:'#58a0e8',5:'#9ad0ff'},
  called:{1:'#5a2a08',2:'#8a4810',3:'#c47a20',4:'#e8a840',5:'#ffd070'},
};

const ITEM_ART = {};
function regItemArt(name, fn) { ITEM_ART[name] = fn; }

// ---- spriteKey -> { s:shape, p:palette } -------------------------------
const ITEM_SPRITE_MAP = {
  potion_pink:{s:'bottle',p:'pink'},potion_red:{s:'bottle',p:'red'},
  potion_red_large:{s:'bottle_large',p:'red'},potion_crimson:{s:'bottle',p:'crimson'},
  potion_orange:{s:'bottle',p:'orange'},potion_blue:{s:'bottle',p:'blue'},
  potion_dark_red:{s:'bottle',p:'dark_red'},potion_dark_blue:{s:'bottle',p:'dark_blue'},
  potion_teal:{s:'bottle',p:'teal'},potion_silver:{s:'bottle',p:'silver'},
  potion_yellow:{s:'bottle',p:'yellow'},potion_dark_green:{s:'bottle',p:'dark_green'},
  potion_grey:{s:'bottle',p:'grey'},potion_black:{s:'bottle',p:'black'},
  potion_white:{s:'bottle',p:'white'},potion_brown:{s:'bottle',p:'brown'},
  vial_green:{s:'vial',p:'green'},vial_dark_green:{s:'vial',p:'dark_green'},
  vial_white:{s:'vial',p:'white'},vial_teal:{s:'vial',p:'teal'},vial_purple:{s:'vial',p:'purple'},
  crystal_pink:{s:'crystal',p:'pink'},crystal_grey:{s:'crystal',p:'silver'},crystal_red:{s:'crystal',p:'red'},
  bomb_grey:{s:'bomb',p:'grey'},bomb_red:{s:'bomb',p:'red'},
  bomb_purple:{s:'bomb',p:'purple'},bomb_white:{s:'bomb',p:'white'},
  pouch_brown:{s:'pouch',p:'brown'},
  scroll_yellow:{s:'scroll',p:'yellow'},scroll_white:{s:'scroll',p:'white'},scroll_red:{s:'scroll',p:'red'},
  book_blue:{s:'book',p:'blue'},book_black:{s:'book',p:'black'},paper_torn:{s:'page',p:'bone'},
  charm_white:{s:'charm',p:'white'},charm_bone:{s:'charm',p:'bone'},charm_twin:{s:'charm_twin',p:'bone'},
  ring_tin:{s:'ring',p:'tin'},ring_bone:{s:'ring',p:'bone'},ring_vigor:{s:'ring',p:'vigor'},
  ring_speed:{s:'ring',p:'speed'},ring_wards:{s:'ring',p:'wards'},ring_called:{s:'ring',p:'called'},
  necklace_bone:{s:'necklace',p:'bone'},necklace_tin:{s:'necklace',p:'tin'},
  necklace_orange:{s:'necklace',p:'orange'},necklace_white:{s:'necklace',p:'white'},
  necklace_silver:{s:'necklace',p:'silver'},necklace_purple:{s:'necklace',p:'purple'},
  necklace_green:{s:'necklace',p:'green'},necklace_crimson:{s:'necklace',p:'crimson'},
  necklace_dark_blue:{s:'necklace',p:'dark_blue'},necklace_grey:{s:'necklace',p:'grey'},
  necklace_teal:{s:'necklace',p:'teal'},necklace_yellow:{s:'necklace',p:'yellow'},
  necklace_blue:{s:'necklace',p:'blue'},necklace_black:{s:'necklace',p:'black'},
  necklace_brown:{s:'necklace',p:'brown'},
  weapon_dagger_red:{s:'dagger',p:'red'},weapon_sword_iron:{s:'sword',p:'iron'},
  weapon_cleaver:{s:'cleaver',p:'iron'},weapon_hatchet_bone:{s:'hatchet',p:'bone'},
  weapon_mace:{s:'mace',p:'iron'},weapon_bow:{s:'bow',p:'brown'},
  weapon_scythe:{s:'scythe',p:'iron'},weapon_brand:{s:'brand',p:'orange'},
  weapon_pick:{s:'pick',p:'iron'},weapon_shard:{s:'shard',p:'void'},
  weapon_sword_mythril:{s:'sword',p:'mythril'},weapon_rapier:{s:'rapier',p:'silver'},
  weapon_longbow:{s:'bow',p:'bone'},weapon_throwaxe:{s:'hatchet',p:'iron'},
  weapon_crossbow:{s:'crossbow',p:'iron'},weapon_boomerang:{s:'boomerang',p:'bone'},
  weapon_voidbow:{s:'bow',p:'void'},weapon_spear:{s:'spear',p:'iron'},
  helm_leather:{s:'helm_dome',p:'leather'},helm_iron:{s:'helm_dome',p:'iron'},
  helm_hood:{s:'helm_hood',p:'cloth'},helm_horned:{s:'helm_horned',p:'iron'},
  helm_crown:{s:'helm_crown',p:'yellow'},helm_circlet:{s:'helm_circlet',p:'silver'},
  helm_bone:{s:'helm_dome',p:'bone'},helm_cloth:{s:'helm_hood',p:'brown'},
  armor_padded:{s:'armor_soft',p:'brown'},armor_leather:{s:'armor_soft',p:'leather'},
  armor_scale:{s:'armor_scale',p:'iron'},armor_cloak:{s:'armor_cloak',p:'cloth'},
  armor_plate:{s:'armor_plate',p:'iron'},armor_bone:{s:'armor_plate',p:'bone'},
  armor_robe:{s:'armor_cloak',p:'purple'},
  legs_grey:{s:'greaves',p:'grey'},legs_iron:{s:'greaves',p:'iron'},
  legs_black:{s:'greaves',p:'black'},legs_green:{s:'greaves',p:'green'},
  legs_brown:{s:'greaves',p:'brown'},legs_yellow:{s:'greaves',p:'yellow'},
  legs_bone:{s:'greaves',p:'bone'},legs_purple:{s:'greaves',p:'purple'},
  legs_blue:{s:'greaves',p:'blue'},legs_white:{s:'greaves',p:'white'},
  legs_orange:{s:'greaves',p:'orange'},legs_silver:{s:'greaves',p:'silver'},
  legs_teal:{s:'greaves',p:'teal'},legs_crimson:{s:'greaves',p:'crimson'},
  legs_dark_blue:{s:'greaves',p:'dark_blue'},legs_dark_red:{s:'greaves',p:'dark_red'},
};

// shared draw helpers passed to every shape fn
const ol = (c = IINK, w = 0.55) => ({ stroke:c, strokeWidth:w, strokeLinejoin:'round', strokeLinecap:'round' });
const glow = (col, r = 2) => ({ filter:`drop-shadow(0 0 ${r}px ${col})` });

// ════════════════════ consumable & accessory shapes ════════════════════
// ── POTION — round-bellied flask, cork, liquid w/ meniscus + highlight ──
regItemArt('bottle', (p, h) => (<>
  {/* glow halo of contents */}
  <ellipse cx="12" cy="15" rx="6.5" ry="6.5" fill={p[4]} opacity="0.16" />
  {/* glass body */}
  <path d="M9.6 9 L14.4 9 L14.4 11 Q18 13 18 16.5 Q18 21 12 21 Q6 21 6 16.5 Q6 13 9.6 11 Z"
    fill={p[3]} {...h.ol(h.IINK,0.6)} />
  {/* liquid surface (meniscus) */}
  <path d="M7 14.4 Q12 13 17 14.4 Q17 21 12 21 Q7 21 7 16.5 Z" fill={p[4]} />
  <path d="M7 14.4 Q12 13 17 14.4 Q12 14 7 14.4 Z" fill={p[5]} opacity="0.85" />
  {/* deep shadow pool */}
  <path d="M8 18.5 Q12 20.6 16 18.5 Q15 21 12 21 Q9 21 8 18.5 Z" fill={p[1]} opacity="0.6" />
  {/* glass specular streak */}
  <path d="M8.6 12 Q7.4 15 8.6 19" stroke="#ffffff" strokeWidth="1.1" opacity="0.5" fill="none" strokeLinecap="round" />
  <circle cx="14.5" cy="17" r="0.8" fill="#fff" opacity="0.4" />
  {/* neck rings */}
  <rect x="9.4" y="8.4" width="5.2" height="1.1" fill={p[2]} {...h.ol(h.IINK,0.4)} />
  {/* cork */}
  <rect x="9.8" y="4.6" width="4.4" height="4" rx="0.6" fill={p.k} {...h.ol(h.IINK,0.5)} />
  <rect x="9.4" y="4" width="5.2" height="1.4" rx="0.4" fill={p.W} {...h.ol(h.IINK,0.4)} />
  <rect x="10.4" y="5" width="0.9" height="3" fill={p.x} opacity="0.7" />
</>));

regItemArt('bottle_large', (p, h) => (<>
  <ellipse cx="12" cy="15" rx="7.4" ry="7.4" fill={p[4]} opacity="0.18" />
  <path d="M9 8 L15 8 L15 10.4 Q19 12.6 19 16.5 Q19 22 12 22 Q5 22 5 16.5 Q5 12.6 9 10.4 Z"
    fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M6 13.6 Q12 12 18 13.6 Q18 22 12 22 Q6 22 6 16.5 Z" fill={p[4]} />
  <path d="M6 13.6 Q12 12.4 18 13.6 Q12 13.4 6 13.6 Z" fill={p[5]} opacity="0.85" />
  <path d="M7 19 Q12 21.4 17 19 Q16 22 12 22 Q8 22 7 19 Z" fill={p[1]} opacity="0.6" />
  <path d="M7.6 11.4 Q6 15 7.6 20" stroke="#fff" strokeWidth="1.2" opacity="0.5" fill="none" strokeLinecap="round" />
  <circle cx="15" cy="17.5" r="1" fill="#fff" opacity="0.4" />
  <rect x="8.8" y="7.2" width="6.4" height="1.2" fill={p[2]} {...h.ol(h.IINK,0.4)} />
  <rect x="9.2" y="3.4" width="5.6" height="4" rx="0.6" fill={p.k} {...h.ol(h.IINK,0.5)} />
  <rect x="8.8" y="2.6" width="6.4" height="1.4" rx="0.4" fill={p.W} {...h.ol(h.IINK,0.4)} />
</>));

// ── VIAL — slim test-tube, glowing reagent ──
regItemArt('vial', (p, h) => (<>
  <ellipse cx="12" cy="16" rx="4.4" ry="6" fill={p[4]} opacity="0.18" />
  <path d="M9.6 6.5 L14.4 6.5 L14 17 Q14 20.6 12 20.6 Q10 20.6 10 17 Z" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <path d="M10.1 12.5 Q12 11.6 13.9 12.5 L13.6 17 Q13.6 20.2 12 20.2 Q10.4 20.2 10.4 17 Z" fill={p[4]} />
  <path d="M10.1 12.5 Q12 11.8 13.9 12.5 Q12 12.4 10.1 12.5 Z" fill={p[5]} />
  <path d="M10.6 14 Q10 16.5 11 19.4" stroke="#fff" strokeWidth="0.8" opacity="0.5" fill="none" strokeLinecap="round" />
  {/* rim + stopper */}
  <rect x="9" y="5.6" width="6" height="1.4" rx="0.5" fill={p.S} {...h.ol(h.IINK,0.4)} />
  <rect x="9.8" y="3" width="4.4" height="2.8" rx="0.5" fill={p.k} {...h.ol(h.IINK,0.5)} />
  {/* rising bubbles */}
  <circle cx="11.4" cy="15" r="0.5" fill={p[5]} opacity="0.8" />
  <circle cx="12.6" cy="13.6" r="0.4" fill={p[5]} opacity="0.7" />
</>));

// ── CRYSTAL — faceted gem with inner light ──
regItemArt('crystal', (p, h) => (<>
  <ellipse cx="12" cy="13" rx="6" ry="7.5" fill={p[4]} opacity="0.2" />
  <path d="M12 2.5 L17 9 L14.5 21 L9.5 21 L7 9 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  {/* facets */}
  <path d="M12 2.5 L12 21 L9.5 21 L7 9 Z" fill={p[2]} />
  <path d="M12 2.5 L17 9 L14.5 21 L12 21 Z" fill={p[4]} />
  <path d="M7 9 L17 9" stroke={p[5]} strokeWidth="0.4" opacity="0.6" />
  <path d="M12 2.5 L12 21" stroke={h.IINK} strokeWidth="0.35" opacity="0.5" />
  {/* inner glow core */}
  <path d="M10.5 9 L13.5 9 L12.6 15 L11.4 15 Z" fill={p[5]} opacity="0.9" {...h.glow(p[5],1.5)} />
  <circle cx="13.6" cy="6.5" r="0.7" fill="#fff" opacity="0.75" />
</>));

// ── BOMB — iron sphere, lit fuse ──
const sparkBits = () => (<>
  <circle cx="16" cy="1.6" r="0.4" fill="#ffd86a"><animate attributeName="opacity" values="1;0;1" dur="0.9s" repeatCount="indefinite"/></circle>
  <circle cx="12.6" cy="1.4" r="0.35" fill="#ffd86a"><animate attributeName="opacity" values="0;1;0" dur="1.1s" repeatCount="indefinite"/></circle>
</>);
regItemArt('bomb', (p, h) => (<>
  <circle cx="11.5" cy="15" r="6.3" fill={p[2]} {...h.ol(h.IINK,0.6)} />
  <path d="M6 13 A6.3 6.3 0 0 1 17 13 A6.3 6.3 0 0 0 6 13 Z" fill={p[3]} />
  <ellipse cx="9" cy="12" rx="2.4" ry="1.8" fill={p[4]} opacity="0.7" />
  <ellipse cx="8.4" cy="11.4" rx="1" ry="0.7" fill="#fff" opacity="0.5" />
  <path d="M8 19.4 Q11.5 21.4 15 19" stroke={p[1]} strokeWidth="0.8" opacity="0.6" fill="none" />
  {/* collar */}
  <rect x="9.6" y="7.4" width="3.8" height="2.4" fill={p.s} {...h.ol(h.IINK,0.45)} />
  <rect x="9.6" y="7.4" width="3.8" height="0.8" fill={p.S} />
  {/* fuse + spark */}
  <path d="M11.5 7.4 Q15 5.5 14 3" stroke={p.w} strokeWidth="0.9" fill="none" strokeLinecap="round" />
  <circle cx="14" cy="2.6" r="1.3" fill="#ff8a30" {...h.glow('#ff9a30',2.5)} />
  <circle cx="14" cy="2.6" r="0.6" fill="#fff6c0" />
  {sparkBits()}
</>));

// ── POUCH — drawstring bag of caltrops ──
regItemArt('pouch', (p, h) => (<>
  <path d="M7 11 Q7 9 9 9 L15 9 Q17 9 17 11 Q18.5 16 17 19.5 Q16 21.5 12 21.5 Q8 21.5 7 19.5 Q5.5 16 7 11 Z"
    fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M7 11 Q7 9 9 9 L12 9 L12 21.5 Q8 21.5 7 19.5 Q5.5 16 7 11 Z" fill={p[2]} opacity="0.55" />
  {/* drawstring neck */}
  <path d="M8.5 9.5 Q12 11 15.5 9.5" stroke={h.IINK} strokeWidth="0.6" fill="none" />
  <path d="M9 7 Q12 9.5 15 7 Q15.5 9 14.5 9.4 L9.5 9.4 Q8.5 9 9 7 Z" fill={p[2]} {...h.ol(h.IINK,0.5)} />
  <path d="M10 5 L10.6 7.2 M14 5 L13.4 7.2" stroke={p.x} strokeWidth="0.9" strokeLinecap="round" />
  {/* caltrops peeking */}
  <path d="M10.2 6.4 L9.4 7.4 L11 7.4 Z" fill={p.S} {...h.ol(h.IINK,0.3)} />
  <path d="M13.8 6.4 L13 7.4 L14.6 7.4 Z" fill={p.S} {...h.ol(h.IINK,0.3)} />
  <circle cx="13" cy="15" r="1.1" fill={p[4]} opacity="0.5" />
</>));

// ── SCROLL — rolled parchment, wax-sealed ribbon ──
regItemArt('scroll', (p, h) => (<>
  <rect x="6" y="6" width="12" height="12" rx="0.6" fill={p.P} {...h.ol(h.IINK,0.55)} />
  <rect x="6" y="6" width="3" height="12" fill={p.p} opacity="0.6" />
  {/* writing */}
  {[9,11,13,15].map((y,i)=><rect key={i} x="8.5" y={y} width={i%2?5:7} height="0.7" fill={p[2]} opacity="0.7" />)}
  {/* rolled ends */}
  <rect x="5" y="4.6" width="14" height="2.4" rx="1.2" fill={p[3]} {...h.ol(h.IINK,0.5)} />
  <rect x="5" y="17" width="14" height="2.4" rx="1.2" fill={p[2]} {...h.ol(h.IINK,0.5)} />
  <rect x="5.4" y="5" width="13.2" height="0.7" fill={p[4]} opacity="0.7" />
  {/* ribbon + wax seal */}
  <rect x="10.6" y="4" width="2.8" height="16" fill={p.z} {...h.ol(h.IINK,0.4)} />
  <circle cx="12" cy="12" r="1.7" fill={p.z} {...h.ol(h.IINK,0.4)} />
  <circle cx="12" cy="12" r="1.7" fill="#a83828" opacity="0.5" />
  <circle cx="11.4" cy="11.4" r="0.5" fill="#fff" opacity="0.4" />
</>));

// ── BOOK — bound tome w/ clasp gem ──
regItemArt('book', (p, h) => (<>
  {/* page block */}
  <rect x="7" y="5" width="11" height="14" fill={p.P} {...h.ol(h.IINK,0.4)} />
  {[6,8,10,12,14,16].map((y,i)=><rect key={i} x="7" y={y} width="11" height="0.4" fill={p.p} opacity="0.7" />)}
  {/* cover */}
  <path d="M5.5 4 L17 4 Q18.5 4 18.5 5.5 L18.5 18.5 Q18.5 20 17 20 L5.5 20 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M5.5 4 L11 4 L11 20 L5.5 20 Z" fill={p[2]} opacity="0.55" />
  {/* spine */}
  <rect x="5.5" y="4" width="2" height="16" fill={p[1]} {...h.ol(h.IINK,0.4)} />
  {/* emblem */}
  <path d="M13 9 L14.6 12 L13 15 L11.4 12 Z" fill={p.G} {...h.ol(h.IINK,0.4)} />
  <circle cx="13" cy="12" r="0.9" fill={p[5]} {...h.glow(p[5],1.2)} />
  <path d="M6.5 5 L6.5 19" stroke={p[4]} strokeWidth="0.4" opacity="0.5" />
</>));

// ── PAGE — single torn note ──
regItemArt('page', (p, h) => (<>
  <path d="M7 5 L16 5 L17 6 L16.5 19 L8 19.5 L7.5 6 Z" fill={p.P} {...h.ol(h.IINK,0.5)} />
  <path d="M7 5 L11.5 5 L11.5 19.4 L8 19.5 L7.5 6 Z" fill={p.p} opacity="0.5" />
  {/* torn bottom edge */}
  <path d="M8 19.4 L9.5 18.4 L11 19.5 L12.5 18.5 L14 19.4 L16.5 19 L16.4 21 L8.1 21.2 Z" fill={p[1]} opacity="0.55" />
  {[8,10,12,14].map((y,i)=><rect key={i} x="9" y={y} width={i%2?4:6} height="0.6" fill={p[2]} opacity="0.7" />)}
  <path d="M15 5 L15 8 L17 6 Z" fill={p[1]} opacity="0.4" />
</>));

// ── CHARM — bone fetish on a cord ──
regItemArt('charm', (p, h) => (<>
  <path d="M9 5 Q12 3 15 5" stroke={p.x} strokeWidth="0.9" fill="none" strokeLinecap="round" />
  <circle cx="12" cy="5.4" r="1.2" fill={p.G} {...h.ol(h.IINK,0.4)} />
  <circle cx="11.6" cy="5" r="0.4" fill="#fff" opacity="0.5" />
  {/* dangling carved icon */}
  <path d="M10 8 Q12 6.5 14 8 Q15 12 13.5 16 Q12 18 12 18 Q12 18 10.5 16 Q9 12 10 8 Z" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <path d="M10 8 Q12 6.5 12 8 L12 18 Q12 18 10.5 16 Q9 12 10 8 Z" fill={p[2]} opacity="0.55" />
  <circle cx="12" cy="11" r="1.5" fill={p[5]} opacity="0.85" {...h.glow(p[5],1.2)} />
  <circle cx="12" cy="11" r="0.7" fill="#fff" opacity="0.5" />
  {/* side beads */}
  <circle cx="9.4" cy="6.4" r="0.7" fill={p[4]} {...h.ol(h.IINK,0.3)} />
  <circle cx="14.6" cy="6.4" r="0.7" fill={p[4]} {...h.ol(h.IINK,0.3)} />
</>));

// ── CHARM_TWIN — paired bone talismans ──
regItemArt('charm_twin', (p, h) => (<>
  <path d="M6 5 Q12 2.5 18 5" stroke={p.x} strokeWidth="0.9" fill="none" strokeLinecap="round" />
  {[8,16].map((cx,i)=>(<g key={i}>
    <circle cx={cx} cy={i?5:5} r="1" fill={p.G} {...h.ol(h.IINK,0.35)} />
    <path d={`M${cx-2} 7 Q${cx} 6 ${cx+2} 7 Q${cx+2.4} 11 ${cx} 14 Q${cx-2.4} 11 ${cx-2} 7 Z`} fill={p[3]} {...h.ol(h.IINK,0.5)} />
    <circle cx={cx} cy="9.5" r="1.1" fill={p[5]} opacity="0.85" {...h.glow(p[5],1)} />
    <path d={`M${cx-2} 7 Q${cx} 6 ${cx} 7 L${cx} 14 Q${cx-2.4} 11 ${cx-2} 7 Z`} fill={p[2]} opacity="0.5" />
  </g>))}
</>));

// ── RING — gold band with raised gem ──
regItemArt('ring', (p, h) => (<>
  <ellipse cx="12" cy="15.5" rx="5" ry="4.6" fill="none" stroke={p.g} strokeWidth="2.2" />
  <ellipse cx="12" cy="15.5" rx="5" ry="4.6" fill="none" stroke={h.IINK} strokeWidth="0.4" />
  <ellipse cx="12" cy="13.6" rx="4.2" ry="1.6" fill="none" stroke={p.Y} strokeWidth="0.9" opacity="0.7" />
  {/* setting */}
  <path d="M9.5 9 L14.5 9 L13.5 12 L10.5 12 Z" fill={p.G} {...h.ol(h.IINK,0.4)} />
  {/* gem */}
  <path d="M12 5.5 L14.8 8.5 L12 11.5 L9.2 8.5 Z" fill={p[3]} {...h.ol(h.IINK,0.5)} />
  <path d="M12 5.5 L12 11.5 L9.2 8.5 Z" fill={p[2]} />
  <path d="M9.2 8.5 L14.8 8.5" stroke={p[5]} strokeWidth="0.4" opacity="0.6" />
  <circle cx="12" cy="8.4" r="1" fill={p[5]} opacity="0.9" {...h.glow(p[5],1.4)} />
  <circle cx="13.4" cy="7" r="0.5" fill="#fff" opacity="0.7" />
</>));

// ── NECKLACE — beaded chain + pendant gem ──
regItemArt('necklace', (p, h) => (<>
  <path d="M6 5 Q6 13 12 14 Q18 13 18 5" fill="none" stroke={p.g} strokeWidth="1" {...h.ol(h.IINK,0.3)} />
  {/* chain beads */}
  {[[6.5,6.5],[7.3,9.2],[9,11.4],[15,11.4],[16.7,9.2],[17.5,6.5]].map((b,i)=>(
    <circle key={i} cx={b[0]} cy={b[1]} r="0.85" fill={p.G} {...h.ol(h.IINK,0.3)} />
  ))}
  {/* pendant mount */}
  <path d="M10.6 13.5 L13.4 13.5 L12 15 Z" fill={p.G} {...h.ol(h.IINK,0.35)} />
  {/* teardrop gem */}
  <path d="M12 14.6 Q15.2 16.5 12 21 Q8.8 16.5 12 14.6 Z" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <path d="M12 14.6 Q15.2 16.5 12 21 Q12 16.5 12 14.6 Z" fill={p[4]} />
  <circle cx="12" cy="17.4" r="1.2" fill={p[5]} opacity="0.9" {...h.glow(p[5],1.4)} />
  <circle cx="10.9" cy="16.3" r="0.5" fill="#fff" opacity="0.6" />
</>));

// ════════════════════ weapon / armor / helm / greave shapes ════════════
// ── SWORD — straight blade, crossguard, pommel (diagonal) ──
regItemArt('sword', (p, h) => (<>
  <g transform="rotate(45 12 12)">
    {/* blade */}
    <path d="M11 1.5 L13 1.5 L13.4 13 L11 14.5 L10.6 13 Z" fill={p[4]} {...h.ol(h.IINK,0.5)} />
    <path d="M11.7 2 L11.7 13.4" stroke={p[5]} strokeWidth="0.7" opacity="0.85" />
    <path d="M12.6 2.4 L12.9 12.8" stroke={p[2]} strokeWidth="0.5" opacity="0.6" />
    <path d="M11 1.5 L13 1.5 L12 0.3 Z" fill={p[5]} {...h.ol(h.IINK,0.3)} />
    {/* crossguard */}
    <rect x="8" y="13.5" width="8" height="2" rx="0.6" fill={p.G} {...h.ol(h.IINK,0.45)} />
    <rect x="8" y="13.5" width="8" height="0.7" fill={p.Y} />
    {/* grip */}
    <rect x="11" y="15.5" width="2" height="5" fill={p.K} {...h.ol(h.IINK,0.4)} />
    {[16.4,17.6,18.8].map((y,i)=><rect key={i} x="11" y={y} width="2" height="0.5" fill={p.x} />)}
    {/* pommel */}
    <circle cx="12" cy="21" r="1.5" fill={p.G} {...h.ol(h.IINK,0.45)} />
    <circle cx="11.4" cy="20.4" r="0.5" fill={p.Y} />
  </g>
</>));

// ── DAGGER — short leaf blade ──
regItemArt('dagger', (p, h) => (<>
  <g transform="rotate(45 12 12)">
    <path d="M11 4 L13 4 Q13.6 8 12 11 Q10.4 8 11 4 Z" fill={p[4]} {...h.ol(h.IINK,0.5)} />
    <path d="M12 4 L12 10.4" stroke={p[5]} strokeWidth="0.6" opacity="0.85" />
    <path d="M11 4 L13 4 L12 2.6 Z" fill={p[5]} {...h.ol(h.IINK,0.3)} />
    <rect x="8.6" y="11" width="6.8" height="1.6" rx="0.5" fill={p.G} {...h.ol(h.IINK,0.4)} />
    <rect x="11" y="12.6" width="2" height="6" fill={p.z} {...h.ol(h.IINK,0.4)} />
    <path d="M11 13.5 L13 14.5 M11 15.5 L13 16.5" stroke={p.x} strokeWidth="0.4" />
    <circle cx="12" cy="19" r="1.2" fill={p.G} {...h.ol(h.IINK,0.4)} />
  </g>
</>));

// ── CLEAVER — heavy chopping blade ──
regItemArt('cleaver', (p, h) => (<>
  <path d="M7 4 L18 4 Q19 4 19 5.5 L19 13 Q19 14.5 17.5 14.5 L7 14.5 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M7 4 L7 14.5 L11 14.5 L11 4 Z" fill={p[5]} opacity="0.45" />
  <path d="M7.5 13.6 L18 13.6" stroke={p[5]} strokeWidth="0.8" opacity="0.8" />
  <circle cx="16" cy="6.5" r="0.9" fill={p[1]} opacity="0.6" />
  {/* spine + handle */}
  <rect x="6" y="4" width="1.4" height="11" fill={p.s} {...h.ol(h.IINK,0.4)} />
  <rect x="6.2" y="14.5" width="2.6" height="6" rx="0.6" fill={p.W} {...h.ol(h.IINK,0.45)} />
  <rect x="6.2" y="14.5" width="0.9" height="6" fill={p.x} opacity="0.6" />
  <rect x="5.6" y="20" width="3.8" height="1.4" rx="0.4" fill={p.g} {...h.ol(h.IINK,0.4)} />
</>));

// ── HATCHET — bearded throwing axe ──
regItemArt('hatchet', (p, h) => (<>
  <rect x="11" y="5" width="1.8" height="15" rx="0.5" fill={p.W} {...h.ol(h.IINK,0.45)} />
  <rect x="11" y="5" width="0.7" height="15" fill={p.x} opacity="0.6" />
  <rect x="10.6" y="19.4" width="2.6" height="1.4" rx="0.4" fill={p.x} {...h.ol(h.IINK,0.35)} />
  {/* head */}
  <path d="M12.5 4 Q18 4.5 18.5 9 Q18.5 11.5 16 12 L12.5 11.5 Z" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <path d="M17.6 5.5 Q19 8.5 16.4 11.4" stroke={p[5]} strokeWidth="0.8" opacity="0.8" fill="none" />
  <path d="M12.5 4 L12.5 11.5 L14.5 11.5 L14.5 4 Z" fill={p[2]} opacity="0.5" />
  <rect x="10.4" y="5" width="2.8" height="6.5" rx="0.5" fill={p.s} {...h.ol(h.IINK,0.4)} />
  <circle cx="11.8" cy="6.5" r="0.6" fill={p.S} />
</>));

// ── MACE — flanged head ──
regItemArt('mace', (p, h) => (<>
  <rect x="11" y="9" width="2" height="11" rx="0.5" fill={p.w} {...h.ol(h.IINK,0.45)} />
  <rect x="11" y="9" width="0.8" height="11" fill={p.x} opacity="0.6" />
  <rect x="10.4" y="19.4" width="3.2" height="1.4" rx="0.4" fill={p.g} {...h.ol(h.IINK,0.4)} />
  {/* flanges */}
  {[0,60,120,180,240,300].map((a,i)=>(
    <rect key={i} x="11.2" y="2" width="1.6" height="4.6" fill={p[3]} {...h.ol(h.IINK,0.4)} transform={`rotate(${a} 12 6)`} />
  ))}
  <circle cx="12" cy="6" r="3.4" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <circle cx="10.8" cy="4.8" r="1.3" fill={p[4]} opacity="0.7" />
  <circle cx="10.4" cy="4.4" r="0.5" fill="#fff" opacity="0.5" />
</>));

// ── BOW — recurve limbs + string + arrow ──
regItemArt('bow', (p, h) => (<>
  <path d="M16 2 Q8 6 8 12 Q8 18 16 22" fill="none" stroke={p[3]} strokeWidth="2" {...h.ol(h.IINK,0.4)} />
  <path d="M16 2 Q8.8 6 8.8 12 Q8.8 18 16 22" fill="none" stroke={p[5]} strokeWidth="0.6" opacity="0.6" />
  {/* string */}
  <path d="M16 2 L16 22" stroke={p[1]} strokeWidth="0.5" opacity="0.85" />
  {/* nocked arrow */}
  <path d="M9 12 L18 12" stroke={p.w} strokeWidth="0.8" />
  <path d="M18 12 L20 11 L20 13 Z" fill={p.S} {...h.ol(h.IINK,0.3)} />
  <path d="M9 12 L7.5 11 M9 12 L7.5 13" stroke={p[2]} strokeWidth="0.7" strokeLinecap="round" />
  <circle cx="8" cy="12" r="0.6" fill={p.W} />
</>));

// ── CROSSBOW ──
regItemArt('crossbow', (p, h) => (<>
  <rect x="4" y="11" width="15" height="2" rx="0.6" fill={p.W} {...h.ol(h.IINK,0.45)} transform="rotate(-30 11 12)" />
  <path d="M14 5 Q19 8 19 12" fill="none" stroke={p[3]} strokeWidth="2" {...h.ol(h.IINK,0.4)} />
  <path d="M14 5 L19 12" stroke={p[1]} strokeWidth="0.5" />
  <path d="M14 5 L16 4 L17 6 Z" fill={p.S} {...h.ol(h.IINK,0.3)} />
  <rect x="6" y="16" width="3" height="4" rx="0.5" fill={p.x} {...h.ol(h.IINK,0.4)} transform="rotate(-30 7.5 18)" />
  <circle cx="12" cy="12" r="1" fill={p.g} {...h.ol(h.IINK,0.35)} />
</>));

// ── SCYTHE — long snath + curved blade ──
regItemArt('scythe', (p, h) => (<>
  <path d="M7 20 Q14 18 15 7" fill="none" stroke={p.W} strokeWidth="1.8" {...h.ol(h.IINK,0.45)} />
  <rect x="6" y="19" width="3" height="1.6" rx="0.4" fill={p.x} {...h.ol(h.IINK,0.35)} transform="rotate(20 7.5 19.8)" />
  {/* blade */}
  <path d="M15 6.5 Q5 4 3 9 Q9 7.5 15 9 Z" fill={p[4]} {...h.ol(h.IINK,0.55)} />
  <path d="M14 7 Q6 5.5 4 8.6" stroke={p[5]} strokeWidth="0.7" opacity="0.85" fill="none" />
  <path d="M15 6.5 Q9 6 4 8.6 Q9 7.5 15 9 Z" fill={p[2]} opacity="0.4" />
  <rect x="13.5" y="6" width="2.4" height="2.4" rx="0.4" fill={p.g} {...h.ol(h.IINK,0.4)} />
</>));

// ── BRAND — torch-sword wreathed in flame ──
regItemArt('brand', (p, h) => (<>
  <g transform="rotate(35 12 12)">
    <path d="M11 6 L13 6 L13 15 L11 15 Z" fill={p[4]} {...h.ol(h.IINK,0.5)} />
    <path d="M12 6 L12 14.6" stroke="#fff" strokeWidth="0.5" opacity="0.6" />
    <rect x="8.6" y="15" width="6.8" height="1.6" rx="0.5" fill={p.g} {...h.ol(h.IINK,0.4)} />
    <rect x="11" y="16.6" width="2" height="5" fill={p.K} {...h.ol(h.IINK,0.4)} />
    <circle cx="12" cy="21.6" r="1.2" fill={p.g} {...h.ol(h.IINK,0.4)} />
    {/* flame */}
    <path d="M12 1 Q9.5 4 11 6 Q12 4.5 12 6 Q13 4.5 13.2 6 Q14.5 4 12 1 Z" fill="#ff7a2a" {...h.glow('#ff8a30',2)} />
    <path d="M12 2.6 Q11 4.4 12 5.6 Q13 4.4 12 2.6 Z" fill="#ffd86a" />
  </g>
</>));

// ── PICK — frostbite mining pick ──
regItemArt('pick', (p, h) => (<>
  <rect x="11" y="7" width="1.8" height="13" rx="0.5" fill={p.W} {...h.ol(h.IINK,0.45)} />
  <rect x="11" y="7" width="0.7" height="13" fill={p.x} opacity="0.6" />
  <path d="M4 9 Q12 4 20 9 L20 7 Q12 2 4 7 Z" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <path d="M4 8 Q12 3.5 20 8" stroke={p[5]} strokeWidth="0.6" opacity="0.7" fill="none" />
  <path d="M3.8 9 L4 7 L5.5 8 Z" fill={p[5]} {...h.ol(h.IINK,0.3)} />
  <path d="M20.2 9 L20 7 L18.5 8 Z" fill={p[5]} {...h.ol(h.IINK,0.3)} />
  <rect x="10.4" y="6.4" width="3.2" height="2.2" rx="0.4" fill={p.s} {...h.ol(h.IINK,0.4)} />
</>));

// ── SHARD — jagged obsidian blade ──
regItemArt('shard', (p, h) => (<>
  <ellipse cx="12" cy="10" rx="5" ry="8" fill={p[4]} opacity="0.15" />
  <path d="M12 2 L15 7 L13.5 11 L14.5 15 L12 17 L9.5 15 L10.5 11 L9 7 Z" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <path d="M12 2 L13.5 11 L12 17 L10.5 11 Z" fill={p[2]} />
  <path d="M12 2 L15 7 L13.5 11 L14.5 15 L12 17 L12 2 Z" fill={p[4]} opacity="0.7" />
  <path d="M12 4 L12 16" stroke={p[5]} strokeWidth="0.4" opacity="0.6" />
  {/* wrapped grip */}
  <rect x="11" y="17" width="2" height="4" fill={p.K} {...h.ol(h.IINK,0.4)} />
  <path d="M11 18 L13 18.6 M11 19.4 L13 20" stroke={p.x} strokeWidth="0.4" />
  <circle cx="13" cy="5.5" r="0.7" fill={p[5]} opacity="0.7" {...h.glow(p[5],1)} />
</>));

// ── RAPIER — thin blade, swept guard ──
regItemArt('rapier', (p, h) => (<>
  <g transform="rotate(45 12 12)">
    <path d="M11.4 1 L12.6 1 L12.6 13 L11.4 13 Z" fill={p[4]} {...h.ol(h.IINK,0.45)} />
    <path d="M12 1 L12 13" stroke={p[5]} strokeWidth="0.5" opacity="0.85" />
    <path d="M11.4 1 L12.6 1 L12 0 Z" fill={p[5]} />
    {/* swept basket guard */}
    <path d="M8.5 13.5 Q12 12 15.5 13.5 Q14 16 12 15 Q10 16 8.5 13.5 Z" fill={p.G} {...h.ol(h.IINK,0.45)} />
    <rect x="11.2" y="15" width="1.6" height="5" fill={p.K} {...h.ol(h.IINK,0.4)} />
    <circle cx="12" cy="20.5" r="1.2" fill={p.G} {...h.ol(h.IINK,0.4)} />
  </g>
</>));

// ── SPEAR — leaf head on long shaft ──
regItemArt('spear', (p, h) => (<>
  <g transform="rotate(45 12 12)">
    <rect x="11.2" y="6" width="1.6" height="15" fill={p.W} {...h.ol(h.IINK,0.45)} />
    <rect x="11.2" y="6" width="0.6" height="15" fill={p.x} opacity="0.6" />
    <path d="M12 1 Q14.5 3.5 13.5 6.5 L10.5 6.5 Q9.5 3.5 12 1 Z" fill={p[4]} {...h.ol(h.IINK,0.5)} />
    <path d="M12 1.5 L12 6" stroke={p[5]} strokeWidth="0.6" opacity="0.85" />
    <rect x="10.4" y="6.4" width="3.2" height="1.4" fill={p.g} {...h.ol(h.IINK,0.4)} />
  </g>
</>));

// ── BOOMERANG — bone hooked throwing arc ──
regItemArt('boomerang', (p, h) => (<>
  <path d="M5 17 Q5 7 12 6 Q19 7 19 17 Q15 14 12 14 Q9 14 5 17 Z" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <path d="M6.5 15.5 Q7 9 12 8" fill="none" stroke={p[5]} strokeWidth="0.7" opacity="0.7" />
  <path d="M5 17 Q5 7 12 6 Q12 14 12 14 Q9 14 5 17 Z" fill={p[2]} opacity="0.45" />
  <circle cx="6.5" cy="16" r="0.6" fill={p[1]} opacity="0.6" />
  <circle cx="17.5" cy="16" r="0.6" fill={p[1]} opacity="0.6" />
</>));

// ── HELM_DOME — rounded helm w/ nasal + slit ──
regItemArt('helm_dome', (p, h) => (<>
  <path d="M6 15 Q6 5 12 5 Q18 5 18 15 L17 16 L7 16 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M6 15 Q6 5 12 5 L12 16 L7 16 Z" fill={p[2]} opacity="0.5" />
  <path d="M7.5 7 Q12 4.5 16.5 7" stroke={p[5]} strokeWidth="0.7" opacity="0.6" fill="none" />
  {/* visor slit */}
  <rect x="7.5" y="11" width="9" height="2" rx="0.6" fill={h.IINK} />
  <path d="M11.4 5 L11.4 13 L12.6 13 L12.6 5 Z" fill={p[4]} opacity="0.6" />
  {/* eye glints in slit */}
  <circle cx="9.6" cy="12" r="0.5" fill={p[5]} opacity="0.7" />
  <circle cx="14.4" cy="12" r="0.5" fill={p[5]} opacity="0.7" />
  <rect x="6.6" y="15" width="10.8" height="1.4" fill={p[1]} {...h.ol(h.IINK,0.35)} />
</>));

// ── HELM_HOOD — soft cowl ──
regItemArt('helm_hood', (p, h) => (<>
  <path d="M6 16 Q5 6 12 5 Q19 6 18 16 L15 16 Q16 9 12 8 Q8 9 9 16 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M6 16 Q5 6 12 5 L12 8 Q8 9 9 16 Z" fill={p[2]} opacity="0.5" />
  <path d="M7 8 Q12 4.5 17 8" stroke={p[4]} strokeWidth="0.6" opacity="0.6" fill="none" />
  {/* shadowed face */}
  <path d="M9 9 Q12 7.5 15 9 Q15 14 12 15 Q9 14 9 9 Z" fill={h.IINK} opacity="0.85" />
  <circle cx="10.6" cy="11" r="0.6" fill={p[5]} opacity="0.6" />
  <circle cx="13.4" cy="11" r="0.6" fill={p[5]} opacity="0.6" />
</>));

// ── HELM_HORNED ──
regItemArt('helm_horned', (p, h) => (<>
  <path d="M3 8 Q5 4 6 9 Q4.5 10 3 8 Z" fill={p[4]} {...h.ol(h.IINK,0.4)} />
  <path d="M21 8 Q19 4 18 9 Q19.5 10 21 8 Z" fill={p[4]} {...h.ol(h.IINK,0.4)} />
  <path d="M6 15 Q6 6 12 6 Q18 6 18 15 L17 16 L7 16 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M6 15 Q6 6 12 6 L12 16 L7 16 Z" fill={p[2]} opacity="0.5" />
  <rect x="7.5" y="11" width="9" height="2" rx="0.6" fill={h.IINK} />
  <circle cx="9.6" cy="12" r="0.5" fill={p[5]} opacity="0.7" />
  <circle cx="14.4" cy="12" r="0.5" fill={p[5]} opacity="0.7" />
  <rect x="11.4" y="6" width="1.2" height="10" fill={p[4]} opacity="0.5" />
</>));

// ── HELM_CROWN — thorny circlet ──
regItemArt('helm_crown', (p, h) => (<>
  <path d="M5 17 L6 9 L9 14 L12 7 L15 14 L18 9 L19 17 Z" fill={p[3]} {...h.ol(h.IINK,0.55)} />
  <path d="M5 17 L19 17 L18.6 19 L5.4 19 Z" fill={p[2]} {...h.ol(h.IINK,0.4)} />
  <path d="M6 9 L9 14 M12 7 L15 14 M18 9" stroke={p[5]} strokeWidth="0.4" opacity="0.6" fill="none" />
  {/* gems */}
  <circle cx="12" cy="11.5" r="1.2" fill={p[5]} {...h.glow(p[5],1.4)} />
  <circle cx="7.5" cy="14.5" r="0.7" fill="#c4302a" />
  <circle cx="16.5" cy="14.5" r="0.7" fill="#2e6fc4" />
  <circle cx="11.4" cy="11" r="0.4" fill="#fff" opacity="0.7" />
</>));

// ── HELM_CIRCLET — slim band + drop gem ──
regItemArt('helm_circlet', (p, h) => (<>
  <path d="M5 14 Q12 17 19 14 L19 16 Q12 19 5 16 Z" fill={p[3]} {...h.ol(h.IINK,0.5)} />
  <path d="M5.5 14.6 Q12 17 18.5 14.6" stroke={p[5]} strokeWidth="0.5" opacity="0.7" fill="none" />
  <path d="M10.5 10 L13.5 10 L12 13 Z" fill={p.G} {...h.ol(h.IINK,0.4)} />
  <path d="M12 6.5 L14 9 L12 11 L10 9 Z" fill={p[4]} {...h.ol(h.IINK,0.45)} />
  <circle cx="12" cy="9" r="0.9" fill={p[5]} {...h.glow(p[5],1.3)} />
  <circle cx="11.2" cy="8.2" r="0.4" fill="#fff" opacity="0.7" />
</>));

// ── ARMOR_PLATE — breastplate w/ pauldrons ──
regItemArt('armor_plate', (p, h) => (<>
  <path d="M7 7 L17 7 L18 10 Q18 18 12 21 Q6 18 6 10 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M7 7 L12 7 L12 21 Q6 18 6 10 Z" fill={p[2]} opacity="0.5" />
  {/* neck + collar */}
  <path d="M9.5 6 L14.5 6 L14 8.5 L10 8.5 Z" fill={p[4]} {...h.ol(h.IINK,0.4)} />
  {/* pauldrons */}
  <ellipse cx="6" cy="8.5" rx="2.6" ry="2" fill={p[4]} {...h.ol(h.IINK,0.5)} />
  <ellipse cx="18" cy="8.5" rx="2.6" ry="2" fill={p[4]} {...h.ol(h.IINK,0.5)} />
  <ellipse cx="5.4" cy="7.8" rx="1.2" ry="0.7" fill={p[5]} opacity="0.5" />
  {/* abdomen lines + center ridge */}
  <path d="M12 9 L12 20" stroke={p[5]} strokeWidth="0.5" opacity="0.5" />
  <path d="M8 13 Q12 14.5 16 13 M8.5 16 Q12 17.2 15.5 16" stroke={h.IINK} strokeWidth="0.5" opacity="0.5" fill="none" />
  <ellipse cx="9.5" cy="10.5" rx="1.4" ry="1" fill={p[5]} opacity="0.3" />
</>));

// ── ARMOR_SOFT — padded/leather jerkin ──
regItemArt('armor_soft', (p, h) => (<>
  <path d="M7 7 L17 7 L17.5 10 Q17 19 12 21 Q7 19 6.5 10 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M7 7 L12 7 L12 21 Q7 19 6.5 10 Z" fill={p[2]} opacity="0.5" />
  <path d="M9.5 6 L14.5 6 L14 8.5 L10 8.5 Z" fill={p[4]} {...h.ol(h.IINK,0.4)} />
  {/* stitched panels */}
  <path d="M12 8.5 L12 20" stroke={p[1]} strokeWidth="0.6" />
  {[10,13,16].map((y,i)=><path key={i} d={`M11.2 ${y} L12.8 ${y}`} stroke={p[5]} strokeWidth="0.5" opacity="0.6" />)}
  <path d="M8 11 Q8 16 9.5 19 M16 11 Q16 16 14.5 19" stroke={h.IINK} strokeWidth="0.4" opacity="0.4" fill="none" />
  {/* shoulder rolls */}
  <ellipse cx="7.5" cy="8" rx="2" ry="1.5" fill={p[4]} {...h.ol(h.IINK,0.4)} />
  <ellipse cx="16.5" cy="8" rx="2" ry="1.5" fill={p[4]} {...h.ol(h.IINK,0.4)} />
</>));

// ── ARMOR_SCALE — overlapping scales ──
regItemArt('armor_scale', (p, h) => (<>
  <path d="M7 7 L17 7 L17.5 10 Q17 19 12 21 Q7 19 6.5 10 Z" fill={p[2]} {...h.ol(h.IINK,0.6)} />
  <clipPath id="scaleclip"><path d="M7 7.4 L17 7.4 L17.4 10 Q17 18.8 12 20.6 Q7 18.8 6.6 10 Z" /></clipPath>
  <g clipPath="url(#scaleclip)">
    {[0,1,2,3,4,5].map(row=>(
      [0,1,2,3,4,5].map(col=>{
        const x = 6.5 + col*1.8 + (row%2)*0.9;
        const y = 7.5 + row*2;
        return <path key={row+'-'+col} d={`M${x} ${y} Q${x+0.9} ${y-0.6} ${x+1.8} ${y} L${x+1.8} ${y+1.2} Q${x+0.9} ${y+2.2} ${x} ${y+1.2} Z`}
          fill={(row+col)%2? p[3]:p[4]} stroke={h.IINK} strokeWidth="0.25" />;
      })
    ))}
  </g>
  <path d="M9.5 6 L14.5 6 L14 8 L10 8 Z" fill={p[4]} {...h.ol(h.IINK,0.4)} />
</>));

// ── ARMOR_CLOAK — hooded robe w/ clasp ──
regItemArt('armor_cloak', (p, h) => (<>
  <path d="M9 4 Q12 2.5 15 4 L15 7 L9 7 Z" fill={p[2]} {...h.ol(h.IINK,0.5)} />
  <path d="M7 8 Q5.5 18 8 21 L16 21 Q18.5 18 17 8 Q14 6 12 6 Q10 6 7 8 Z" fill={p[3]} {...h.ol(h.IINK,0.6)} />
  <path d="M7 8 Q5.5 18 8 21 L12 21 L12 6 Q10 6 7 8 Z" fill={p[2]} opacity="0.5" />
  {/* drape folds */}
  {[9.5,12,14.5].map((x,i)=><path key={i} d={`M${x} 8 Q${x} 15 ${x} 20.5`} stroke={h.IINK} strokeWidth="0.45" opacity="0.45" fill="none" />)}
  <path d="M8 9 Q12 11 16 9" stroke={p[5]} strokeWidth="0.5" opacity="0.5" fill="none" />
  {/* clasp */}
  <circle cx="12" cy="8" r="1.3" fill={p.G} {...h.ol(h.IINK,0.4)} />
  <circle cx="12" cy="8" r="0.5" fill={p[5]} {...h.glow(p[5],1)} />
</>));

// ── GREAVES — paired leg plates + boots ──
regItemArt('greaves', (p, h) => (<>
  {[8.5,15.5].map((cx,i)=>(<g key={i}>
    <path d={`M${cx-2.2} 5 L${cx+2.2} 5 L${cx+1.8} 16 L${cx-1.8} 16 Z`} fill={p[3]} {...h.ol(h.IINK,0.55)} />
    <path d={`M${cx-2.2} 5 L${cx} 5 L${cx} 16 L${cx-1.8} 16 Z`} fill={p[2]} opacity="0.5" />
    {/* knee cop */}
    <ellipse cx={cx} cy="6.5" rx="2.4" ry="1.8" fill={p[4]} {...h.ol(h.IINK,0.45)} />
    <ellipse cx={cx-0.6} cy="6" rx="0.9" ry="0.6" fill={p[5]} opacity="0.5" />
    {/* shin ridge */}
    <path d={`M${cx} 8 L${cx} 15`} stroke={p[5]} strokeWidth="0.5" opacity="0.6" />
    <path d={`M${cx-1.6} 11 L${cx+1.6} 11`} stroke={h.IINK} strokeWidth="0.4" opacity="0.45" />
    {/* sabaton */}
    <path d={`M${cx-1.8} 16 L${cx+1.8} 16 L${cx+2.6} 19.5 Q${cx+2.6} 20.5 ${cx+1.5} 20.5 L${cx-2} 20.5 Z`} fill={p[2]} {...h.ol(h.IINK,0.5)} />
    <path d={`M${cx-1.8} 17 L${cx+2} 17`} stroke={p[4]} strokeWidth="0.5" opacity="0.6" />
  </g>))}
</>));

// ═══════════════════════════════════════════════════════════════════════
// SVG builder + canvas rasteriser
// ═══════════════════════════════════════════════════════════════════════
const HELPERS = { ol, glow, IINK };

export function itemSpriteSVG(spriteKey, px = 192) {
  const map = ITEM_SPRITE_MAP[spriteKey];
  if (!map) return '';
  const fn = ITEM_ART[map.s];
  if (!fn) return '';
  const p = { ...ICONST, ...IPAL[map.p] };
  const body = fn(p, HELPERS);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" `
    + `width="${px}" height="${px}" style="overflow:visible">${body}</svg>`;
}

export function hasItemArt(spriteKey) { return !!ITEM_SPRITE_MAP[spriteKey]; }

export function preloadItemArt() {
  for (const key in ITEM_SPRITE_MAP) rasterPreload('item:' + key, () => itemSpriteSVG(key, 192));
}

/** Draw item `spriteKey` into (x,y) at size×size. Returns false until decoded. */
export function drawVectorItem(ctx, x, y, size, spriteKey) {
  if (!ITEM_SPRITE_MAP[spriteKey]) return false;
  return rasterDraw(ctx, x, y, size, 'item:' + spriteKey, () => itemSpriteSVG(spriteKey, 192));
}

export { ITEM_SPRITE_MAP as SPRITE_MAP, ITEM_ART, IPAL };

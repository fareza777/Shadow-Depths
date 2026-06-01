// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Forge Materials  (the 10 crafting reagents)
//  ────────────────────────────────────────────────────────────────────
//  The "RES" stacks a hero hoards for the Veiled Smith. One bespoke icon
//  per material id in the game registry — same idiom as the item engine:
//  32-grid SVG, ink outlines (#08070c), multi-tone shading, specular
//  highlight, glow on the volatile ones. Each idles with a soft float;
//  the glowy reagents (ember · void · sun · frost) pulse.
//
//  Drop-in:
//    <Material id="scrap_iron"  size={64} float />
//    <Material id="void_essence" size={48} />
//
//  spriteKey maps 1:1 to itemSprites.js  material_<id>  and the biome
//  pairing in Crafting.js BIOME_MATERIALS:
//    forgotten_crypts scrap_iron+crypt_dust · iron_stronghold scrap_iron+iron_chip
//    bone_garden bone_shard · drowned_catacombs crypt_dust · magma_foundry ember_dust
//    sun_cursed_sands sun_glass · frozen_halls frost_thread · void_sanctum void_essence
//    mirror_vaults mirror_shard · sunken_forest verdant_sap
// ═══════════════════════════════════════════════════════════════════════
import { h, Fragment } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const MINK = '#08070c';
const _mhex = (c)=>{c=c.replace('#','');return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];};
const mmix = (a,b,t)=>{const A=_mhex(a),B=_mhex(b);const m=A.map((v,i)=>Math.round(v+(B[i]-v)*t));return `rgb(${m[0]},${m[1]},${m[2]})`;};
const mol = (c=MINK,w=0.6)=>({ stroke:c, strokeWidth:w, strokeLinejoin:'round', strokeLinecap:'round' });
const mgl = (col,r=2)=>({ filter:`drop-shadow(0 0 ${r}px ${col})` });
const Pulse = (a, dur=2.4, lo=0.55, hi=1)=> a && <animate attributeName="opacity" values={`${lo};${hi};${lo}`} dur={`${dur}s`} repeatCount="indefinite"/>;

const MATERIALS = {

// ── SCRAP IRON — a bent, rusted offcut + loose rivets ───────────────────
scrap_iron: () => {
  const lo='#34323a', mid='#8f949c', hi='#d7d9df', rust='#7a4e34';
  return (<>
    <path d="M7 19 L13 11 L17 13 L12 21 Z" fill={mid} {...mol()}/>
    <path d="M7 19 L13 11 L14.4 11.7 L8.4 19.7 Z" fill={hi} opacity="0.8"/>
    <path d="M12 21 L17 13 L24 16 L23 22 L17 24 Z" fill={mmix(mid,lo,0.35)} {...mol()}/>
    <path d="M17 13 L24 16 L23.4 17 L17.4 14.2 Z" fill={hi} opacity="0.55"/>
    <path d="M17 24 L23 22 L22 25 L18 25.5 Z" fill={lo}/>
    {/* rust freckles */}
    {[[12,16],[19,19],[21,21]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="0.7" fill={rust} opacity="0.7"/>)}
    {/* loose rivets */}
    <circle cx="9" cy="23" r="1.4" fill={mid} {...mol(MINK,0.4)}/>
    <circle cx="8.5" cy="22.6" r="0.5" fill={hi}/>
    <circle cx="25" cy="12" r="1.2" fill={mmix(mid,lo,0.3)} {...mol(MINK,0.4)}/>
  </>);
},

// ── IRON CHIP — a clean sharp shard knapped off the stronghold's plate ──
iron_chip: () => {
  const lo='#2e2c34', mid='#6f7480', hi='#c8cbd0';
  return (<>
    <path d="M16 5 L23 17 L18 26 L9 22 L10 12 Z" fill={mid} {...mol()}/>
    <path d="M16 5 L10 12 L9 22 L13 18 Z" fill={lo}/>
    <path d="M16 5 L23 17 L17 18 Z" fill={hi} opacity="0.9"/>
    <path d="M17 18 L18 26 L13 18 Z" fill={mmix(mid,hi,0.3)} opacity="0.7"/>
    {/* facet glint */}
    <path d="M16.5 7 L20 13 L18 14 Z" fill="#ffffff" opacity="0.55"/>
    <circle cx="14" cy="20" r="0.5" fill={hi} opacity="0.7"/>
  </>);
},

// ── CRYPT DUST — a tied burlap pouch leaking grey ash ───────────────────
crypt_dust: (a) => {
  const sack='#6a5d4c', sackHi='#8a7868', dust='#d0c0a0', tie='#3a3026';
  return (<>
    <ellipse cx="16" cy="26" rx="8" ry="2" fill="#000" opacity="0.25"/>
    <path d="M9 14 Q9 26 16 26 Q23 26 23 14 Q23 11 19 10 L13 10 Q9 11 9 14 Z" fill={sack} {...mol()}/>
    <path d="M9 14 Q9 26 16 26 Q13 26 12 18 Q11 13 13 10 Q9 11 9 14 Z" fill="#000" opacity="0.18"/>
    <path d="M11 14 Q16 12 21 14" fill="none" stroke={sackHi} strokeWidth="0.8" opacity="0.6"/>
    {/* cinched neck */}
    <path d="M13 10 L19 10 L20 7 L12 7 Z" fill={mmix(sack,sackHi,0.5)} {...mol()}/>
    <rect x="12" y="9" width="8" height="1.6" fill={tie} {...mol(MINK,0.3)}/>
    <path d="M12 7 Q16 8.4 20 7" fill="none" stroke={tie} strokeWidth="1"/>
    {/* escaping dust */}
    {[[14,5,0.7],[17,4,0.6],[16,2.5,0.5]].map(([x,y,r],i)=>(
      <circle key={i} cx={x} cy={y} r={r} fill={dust} opacity="0.55">
        {a && <><animate attributeName="cy" values={`${y};${y-2.5};${y}`} dur={`${2.6+i*0.4}s`} repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0;0.6" dur={`${2.6+i*0.4}s`} repeatCount="indefinite"/></>}
      </circle>
    ))}
  </>);
},

// ── BONE SHARD — a splintered femur fragment ────────────────────────────
bone_shard: () => {
  const lo='#66553a', mid='#d7c9a8', hi='#fff0c8';
  return (<>
    <ellipse cx="16" cy="26" rx="7" ry="1.8" fill="#000" opacity="0.22"/>
    <path d="M11 8 Q9 6 11 6 Q13 6 13 8 L14 9 L19 23 L18 25 Q19 27 17 26 Q15 26 16 24 L11 10 Z" fill={mid} {...mol()}/>
    {/* second knuckle lobe up top */}
    <circle cx="13.4" cy="7.2" r="1.6" fill={mid} {...mol(MINK,0.4)}/>
    <circle cx="11" cy="7.6" r="1.5" fill={mmix(mid,lo,0.2)} {...mol(MINK,0.4)}/>
    <circle cx="17.2" cy="25" r="1.6" fill={mid} {...mol(MINK,0.4)}/>
    <circle cx="18.6" cy="23.4" r="1.4" fill={mmix(mid,lo,0.2)} {...mol(MINK,0.4)}/>
    {/* shaft shading + crack */}
    <path d="M12.2 10 L16.4 22 L15 22.4 L11 10.6 Z" fill={lo} opacity="0.5"/>
    <path d="M13 11 L15.5 20" stroke={hi} strokeWidth="0.6" opacity="0.7"/>
    <path d="M14 14 L13 16 L14.4 18" stroke={MINK} strokeWidth="0.4" opacity="0.5" fill="none"/>
  </>);
},

// ── EMBER DUST — a smouldering pinch of coals ───────────────────────────
ember_dust: (a) => {
  const base='#7a3418', mid='#b85830', glow='#ffb048', hot='#ffe6a0';
  return (<>
    <ellipse cx="16" cy="24" rx="8.5" ry="2.4" fill="#000" opacity="0.25"/>
    {/* heaped coals */}
    <path d="M8 24 Q9 17 16 17 Q23 17 24 24 Z" fill={base} {...mol()}/>
    <path d="M8 24 Q9 17 16 17 Q12 18 11 24 Z" fill="#000" opacity="0.2"/>
    {[[11,22,1],[14,20,1.3],[18,21,1.2],[21,22.5,1],[16,22,1.1]].map(([x,y,r],i)=>(
      <circle key={i} cx={x} cy={y} r={r} fill={i%2?mid:glow} style={mgl(glow,2)}>
        {a && <animate attributeName="opacity" values="0.55;1;0.55" dur={`${0.8+i*0.2}s`} repeatCount="indefinite"/>}
      </circle>
    ))}
    {/* rising sparks */}
    {[[12,15,0.5],[18,14,0.5],[16,12,0.4]].map(([x,y,r],i)=>(
      <circle key={i} cx={x} cy={y} r={r} fill={hot} style={mgl(glow,2)}>
        {a && <><animate attributeName="cy" values={`${y};${y-5};${y}`} dur={`${1.5+i*0.4}s`} repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0;1" dur={`${1.5+i*0.4}s`} repeatCount="indefinite"/></>}
      </circle>
    ))}
    <ellipse cx="16" cy="20" rx="11" ry="8" fill={glow} opacity="0.12" style={mgl(glow,3)}>{Pulse(a,2.2,0.06,0.18)}</ellipse>
  </>);
},

// ── SUN GLASS — a faceted golden glass crystal ──────────────────────────
sun_glass: (a) => {
  const lo='#a8761f', mid='#f0c060', hi='#fff2c0';
  return (<>
    <ellipse cx="16" cy="27" rx="6" ry="1.6" fill="#000" opacity="0.2"/>
    <path d="M16 4 L22 13 L19 25 L13 25 L10 13 Z" fill={mid} {...mol()} style={mgl('#f0c060',2.5)}/>
    <path d="M16 4 L10 13 L13 25 L15 16 Z" fill={lo} opacity="0.85"/>
    <path d="M16 4 L22 13 L16 16 Z" fill={hi} opacity="0.9"/>
    <path d="M16 16 L19 25 L16 25 Z" fill={hi} opacity="0.45"/>
    <path d="M15 7 L13 12 L15.5 13 Z" fill="#ffffff" opacity="0.6"/>
    <circle cx="16" cy="14" r="9" fill="#f0c060" opacity="0.1" style={mgl('#f0c060',3)}>{Pulse(a,2.6,0.05,0.16)}</circle>
  </>);
},

// ── FROST THREAD — a skein of pale-blue spun ice fibre ──────────────────
frost_thread: (a) => {
  const wood='#5a4a38', woodHi='#7a6648', thread='#bcd6ff', threadLo='#6f93c8';
  return (<>
    <ellipse cx="16" cy="26" rx="7" ry="1.8" fill="#000" opacity="0.2"/>
    {/* spool ends */}
    <rect x="9" y="9" width="14" height="2.4" rx="1" fill={wood} {...mol()}/>
    <rect x="9" y="20.6" width="14" height="2.4" rx="1" fill={wood} {...mol()}/>
    <rect x="9" y="9" width="14" height="0.8" fill={woodHi} opacity="0.7"/>
    {/* wound thread body */}
    <rect x="11" y="11" width="10" height="10" fill={threadLo} {...mol(MINK,0.5)}/>
    {[12,14,16,18,20].map((y,i)=>(
      <line key={i} x1="11" y1={y} x2="21" y2={y} stroke={thread} strokeWidth="0.9" opacity={0.6+ (i%2)*0.3} style={mgl(thread,1)}/>
    ))}
    <rect x="11" y="11" width="3" height="10" fill="#fff" opacity="0.12"/>
    {/* loose strand + drifting glint */}
    <path d="M21 14 Q26 15 24 19" fill="none" stroke={thread} strokeWidth="0.8" style={mgl(thread,1)}/>
    <circle cx="24" cy="19" r="0.7" fill="#fff" style={mgl(thread,2)}>{Pulse(a,2,0.5,1)}</circle>
  </>);
},

// ── VOID ESSENCE — a stoppered phial of churning dark light ─────────────
void_essence: (a) => {
  const glass='#2a2436', glow='#c060ff', deep='#4b2a6a', cork='#3a2c1e';
  return (<>
    <ellipse cx="16" cy="27" rx="5.5" ry="1.6" fill="#000" opacity="0.25"/>
    {/* phial */}
    <path d="M13 11 L19 11 L20 22 Q20 26 16 26 Q12 26 12 22 Z" fill={glass} {...mol()}/>
    <path d="M13 11 L15 11 L14 22 Q14 25 16 26 Q12 26 12 22 Z" fill="#000" opacity="0.2"/>
    {/* swirling void */}
    <ellipse cx="16" cy="20" rx="3.4" ry="4.2" fill={deep} style={mgl(glow,2)}/>
    <ellipse cx="16" cy="20" rx="1.8" ry="2.4" fill={glow} style={mgl(glow,3)}>{Pulse(a,1.8,0.6,1)}</ellipse>
    <circle cx="15.2" cy="18.6" r="0.6" fill="#fff" opacity="0.8"/>
    {/* neck + cork */}
    <rect x="13.4" y="8.5" width="5.2" height="3" fill={glass} {...mol(MINK,0.4)}/>
    <rect x="13" y="6.5" width="6" height="2.6" rx="0.6" fill={cork} {...mol(MINK,0.4)}/>
    <rect x="13" y="6.5" width="6" height="0.8" fill={mmix(cork,'#fff',0.3)}/>
    {/* leaking motes */}
    {[[15,5,0.5],[18,4,0.4]].map(([x,y,r],i)=>(
      <circle key={i} cx={x} cy={y} r={r} fill={glow} style={mgl(glow,2)}>
        {a && <><animate attributeName="cy" values={`${y};${y-2.5};${y}`} dur={`${2.4+i*0.5}s`} repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.9;0;0.9" dur={`${2.4+i*0.5}s`} repeatCount="indefinite"/></>}
      </circle>
    ))}
  </>);
},

// ── MIRROR SHARD — a sliver of silvered glass throwing light ────────────
mirror_shard: (a) => {
  const lo='#3e4560', mid='#9fb6d8', edge='#5a6788';
  return (<>
    <ellipse cx="16" cy="26.5" rx="6" ry="1.5" fill="#000" opacity="0.2"/>
    <path d="M13 5 L20 9 L21 24 L14 26 L11 12 Z" fill={mid} {...mol()} style={mgl('#cfe0ff',1.5)}/>
    {/* reflective split */}
    <path d="M13 5 L11 12 L14 26 L15 14 Z" fill={lo} opacity="0.8"/>
    <path d="M16 9 L20 9 L21 24 L17 20 Z" fill="#dfeaff" opacity="0.55"/>
    {/* hard specular streak */}
    <path d="M14 8 L17 16 L15.5 16.5 L12.5 9 Z" fill="#ffffff" opacity="0.7"/>
    <path d="M11 12 L13 5 L13.6 5.4 Z" fill={edge}/>
    <circle cx="18" cy="14" r="0.6" fill="#fff" style={mgl('#fff',2)}>{Pulse(a,1.6,0.4,1)}</circle>
  </>);
},

// ── VERDANT SAP — a heavy bead of luminous forest resin ─────────────────
verdant_sap: (a) => {
  const lo='#2c6e34', mid='#48b858', hi='#a8f0a0', bark='#4a3a26';
  return (<>
    <ellipse cx="16" cy="27" rx="6" ry="1.6" fill="#000" opacity="0.2"/>
    {/* twig it clings to */}
    <path d="M9 7 Q16 9 23 7" fill="none" stroke={bark} strokeWidth="1.8" {...mol(MINK,0.4)}/>
    <path d="M9 7 Q16 9 23 7" fill="none" stroke={mmix(bark,'#fff',0.25)} strokeWidth="0.5" opacity="0.6"/>
    {/* hanging droplet */}
    <path d="M16 9 Q11 14 12.5 21 Q14 26 16 26 Q18 26 19.5 21 Q21 14 16 9 Z" fill={mid} {...mol()} style={mgl(mid,2)}/>
    <path d="M16 9 Q11 14 12.5 21 Q14 26 15 24 Q12.5 16 16 11 Z" fill={lo} opacity="0.6"/>
    <ellipse cx="14.6" cy="15" rx="1.4" ry="2.4" fill={hi} opacity="0.7"/>
    <circle cx="17.4" cy="20" r="1" fill={hi} opacity="0.4"/>
    <circle cx="16" cy="18" r="8" fill={mid} opacity="0.1" style={mgl(mid,3)}>{Pulse(a,2.8,0.05,0.15)}</circle>
  </>);
},

};

const MATERIAL_META = {
  scrap_iron:   { name:'Scrap Iron',    spriteKey:'material_scrap_iron',   biomes:'Crypts · Stronghold · Bone · Magma' },
  iron_chip:    { name:'Iron Chip',     spriteKey:'material_iron_chip',    biomes:'Iron Stronghold' },
  crypt_dust:   { name:'Crypt Dust',    spriteKey:'material_crypt_dust',   biomes:'Forgotten Crypts · Catacombs' },
  bone_shard:   { name:'Bone Shard',    spriteKey:'material_bone_shard',   biomes:'Bone Garden · Frozen · Void · Forest' },
  ember_dust:   { name:'Ember Dust',    spriteKey:'material_ember_dust',   biomes:'Magma Foundry · Sands' },
  sun_glass:    { name:'Sun Glass',     spriteKey:'material_sun_glass',    biomes:'Sun-Cursed Sands' },
  frost_thread: { name:'Frost Thread',  spriteKey:'material_frost_thread', biomes:'Frozen Halls' },
  void_essence: { name:'Void Essence',  spriteKey:'material_void_essence', biomes:'Void Sanctum · Mirror Vaults' },
  mirror_shard: { name:'Mirror Shard',  spriteKey:'material_mirror_shard', biomes:'Mirror Vaults' },
  verdant_sap:  { name:'Verdant Sap',   spriteKey:'material_verdant_sap',  biomes:'Sunken Forest' },
};

const MATERIAL_ORDER = ['scrap_iron','iron_chip','crypt_dust','bone_shard','ember_dust','sun_glass','frost_thread','void_essence','mirror_shard','verdant_sap'];

function Material({ id='scrap_iron', size=64, float=false, animate=true, style }) {
  const fn = MATERIALS[id] || MATERIALS.scrap_iron;
  return (
    <div style={{ display:'inline-block', lineHeight:0,
      animation: float ? 'matFloat 3.4s ease-in-out infinite' : 'none', ...(style||{}) }}>
      <svg width={size} height={size} viewBox="0 0 32 32"
        style={{ display:'block', overflow:'visible',
          filter:`drop-shadow(0 ${size/24}px ${size/18}px rgba(0,0,0,0.45))` }}>
        {fn(animate)}
      </svg>
    </div>
  );
}

const MATERIAL_OVERSCAN = 0.08;
const materialKey = (id) => `material:${id}`;

export function materialSVG(id = 'scrap_iron', px = 256) {
  const fn = MATERIALS[id] || MATERIALS.scrap_iron;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 36 36" width="${px}" height="${px}" style="overflow:visible">`
    + fn(false)
    + `</svg>`;
}

export function drawVectorMaterial(ctx, x, y, size, id) {
  const key = materialKey(id);
  return rasterDraw(ctx, x, y, size, key, () => materialSVG(id, 256), MATERIAL_OVERSCAN);
}

export function preloadMaterialArt() {
  for (const id of MATERIAL_ORDER) rasterPreload(materialKey(id), () => materialSVG(id, 256));
}

export { MATERIALS, MATERIAL_META, MATERIAL_ORDER };

// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Wall Decor — Extended Set
//  ────────────────────────────────────────────────────────────────────
//  Eight more atmosphere props to dress walls & corners, complementing the
//  base set (torch · brazier · banner · bones · pillar · chains · gargoyle
//  · cobweb · crack). Same idiom: 32-grid SVG, ink outlines, multi-tone,
//  biome-tinted glow, drop-shadow. Most re-tint from a biome palette.
//
//  Drop-in (identical call to the base Decor engine):
//    <DecorX kind="weapon_rack" biome={BIOMES_F[i]} size={104} animate />
//
//  Kinds: weapon_rack · alcove_urn · hanging_cage · shelf ·
//         moss_vines · supply_crate · candelabra · mushroom_cluster
// ═══════════════════════════════════════════════════════════════════════
import { h, Fragment } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const XINK = '#08070c';
const _xhex = (c)=>{c=c.replace('#','');return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];};
const xmix = (a,b,t)=>{const A=_xhex(a),B=_xhex(b);const m=A.map((v,i)=>Math.round(v+(B[i]-v)*t));return `rgb(${m[0]},${m[1]},${m[2]})`;};
const xol = (c=XINK,w=0.6)=>({ stroke:c, strokeWidth:w, strokeLinejoin:'round', strokeLinecap:'round' });
const xgl = (col,r=2)=>({ filter:`drop-shadow(0 0 ${r}px ${col})` });
const xFlame = (cx, top, w, tint, a, key) => (
  <g key={key} style={xgl(tint,2)}>
    <path d={`M${cx} ${top} Q${cx-w} ${top+w*1.5} ${cx} ${top+w*2.6} Q${cx+w} ${top+w*1.5} ${cx} ${top} Z`} fill={tint}>
      {a && <animate attributeName="opacity" values="0.78;1;0.78" dur="0.6s" repeatCount="indefinite"/>}
    </path>
    <path d={`M${cx} ${top+w*0.8} Q${cx-w*0.4} ${top+w*1.6} ${cx} ${top+w*2.2} Q${cx+w*0.4} ${top+w*1.6} ${cx} ${top+w*0.8} Z`} fill="#fff7e0" opacity="0.9"/>
  </g>
);

const DECOR_X = {

// ── WEAPON RACK — a timber rack holding salvaged arms ───────────────────
weapon_rack: (b) => {
  const wood='#4a3422', woodHi='#6a4a30', steel='#8a909a', steelHi='#cfd4dc';
  return (<>
    <ellipse cx="16" cy="28.5" rx="10" ry="2.2" fill="#000" opacity="0.28"/>
    {/* frame */}
    <rect x="5" y="6" width="2" height="22" fill={wood} {...xol()}/>
    <rect x="25" y="6" width="2" height="22" fill={wood} {...xol()}/>
    <rect x="5" y="6" width="22" height="2" fill={woodHi} {...xol()}/>
    <rect x="5" y="20" width="22" height="2" fill={wood} {...xol()}/>
    <rect x="5" y="6" width="22" height="0.6" fill={xmix(woodHi,'#fff',0.2)} opacity="0.6"/>
    {/* sword */}
    <rect x="10" y="8" width="1.4" height="13" fill={steel} {...xol(XINK,0.4)}/>
    <rect x="10" y="8" width="0.6" height="13" fill={steelHi} opacity="0.7"/>
    <rect x="8.6" y="13" width="4.2" height="1.2" fill={b.cap} {...xol(XINK,0.3)}/>
    <rect x="10.2" y="20.4" width="1" height="2.4" fill={b.cap}/>
    {/* spear */}
    <rect x="16" y="7" width="1" height="15.5" fill={woodHi} {...xol(XINK,0.4)}/>
    <path d="M16.5 5 L18 8 L15 8 Z" fill={steelHi} {...xol(XINK,0.4)}/>
    {/* axe */}
    <rect x="21" y="9" width="1.2" height="13" fill={woodHi} {...xol(XINK,0.4)} transform="rotate(6 21.6 15)"/>
    <path d="M19.5 10 Q24 9 23 13 Q19.5 13 19.5 10 Z" fill={steel} {...xol(XINK,0.4)}/>
    <path d="M19.5 10 Q24 9 23 13" fill="none" stroke={steelHi} strokeWidth="0.5" opacity="0.7"/>
  </>);
},

// ── ALCOVE URN — a wall niche cradling a funerary urn + soul-flame ───────
alcove_urn: (b, a) => {
  const [sl,sd]=b.stone; const mid=xmix(sl,sd,0.35);
  const urn=xmix(sd,'#000',0.1), urnHi=xmix(sl,sd,0.5);
  return (<>
    {/* arched niche cut into the wall */}
    <path d="M7 28 L7 12 Q7 5 16 5 Q25 5 25 12 L25 28 Z" fill="#0a0810" {...xol()}/>
    <path d="M7 28 L7 12 Q7 5 16 5 Q25 5 25 12 L25 28" fill="none" stroke={mid} strokeWidth="1.4"/>
    <path d="M8 12 Q8 6.5 16 6.5 Q24 6.5 24 12" fill="none" stroke={xmix(sl,sd,0.5)} strokeWidth="0.5" opacity="0.6"/>
    {/* urn */}
    <ellipse cx="16" cy="27" rx="6" ry="1.6" fill="#000" opacity="0.4"/>
    <path d="M11 17 Q11 26 16 26 Q21 26 21 17 Q21 14 16 13.5 Q11 14 11 17 Z" fill={urn} {...xol()}/>
    <path d="M11 17 Q11 26 16 26 Q13 25 12.5 19 Q12 15 14 13.7 Q11 14 11 17 Z" fill="#000" opacity="0.2"/>
    <ellipse cx="16" cy="13.6" rx="3.4" ry="1.1" fill={urnHi} {...xol(XINK,0.4)}/>
    <ellipse cx="16" cy="13.6" rx="2" ry="0.6" fill="#000"/>
    <rect x="11.4" y="18.5" width="9.2" height="1.6" fill={b.cap} opacity="0.45"/>
    {/* soul flame rising from the urn */}
    {xFlame(16, 7.5, 1.8, b.ambient, a, 'sf')}
    <ellipse cx="16" cy="11" rx="5" ry="6" fill={b.ambient} opacity="0.12" style={xgl(b.ambient,3)}>
      {a && <animate attributeName="opacity" values="0.06;0.16;0.06" dur="2.4s" repeatCount="indefinite"/>}
    </ellipse>
  </>);
},

// ── HANGING CAGE — an iron gibbet swaying with old bones ─────────────────
hanging_cage: (b, a) => {
  const iron='#4a4650', ironHi='#7a7686', bone='#c4b78e';
  return (
    <g style={{ transformOrigin:'16px 4px' }}>
      {a && <animateTransform attributeName="transform" type="rotate" values="-3 16 4;3 16 4;-3 16 4" dur="4s" repeatCount="indefinite"/>}
      {/* chain to ceiling */}
      {[5,8,11].map((y,i)=><ellipse key={i} cx="16" cy={y} rx="1.1" ry="1.6" fill="none" stroke={iron} strokeWidth="1"/>)}
      <circle cx="16" cy="3" r="1.4" fill={iron} {...xol(XINK,0.4)}/>
      {/* cage cap + bars */}
      <path d="M9 14 Q9 12 16 12 Q23 12 23 14 Z" fill={iron} {...xol()}/>
      <path d="M9 14 L10 26 Q16 28 22 26 L23 14 Z" fill="#0a0810" {...xol()}/>
      {[11,13.5,16,18.5,21].map((x,i)=><line key={i} x1={x} y1="13.5" x2={x+(i-2)*0.5} y2="26.5" stroke={iron} strokeWidth="1"/>)}
      <path d="M10 19 Q16 20.5 22 19" fill="none" stroke={iron} strokeWidth="0.9"/>
      <path d="M9.6 24 Q16 25.6 22.4 24" fill="none" stroke={iron} strokeWidth="0.9"/>
      {/* skull + bones inside */}
      <circle cx="15.5" cy="22" r="2.4" fill={bone} {...xol(XINK,0.4)}/>
      <ellipse cx="14.6" cy="21.8" rx="0.7" ry="0.9" fill={XINK}/>
      <ellipse cx="16.4" cy="21.8" rx="0.7" ry="0.9" fill={XINK}/>
      <rect x="14.8" y="23.6" width="2" height="1.6" fill={xmix(bone,'#000',0.25)}/>
      {/* glints */}
      <circle cx="10.4" cy="15" r="0.4" fill={ironHi} opacity="0.7"/>
    </g>
  );
},

// ── APOTHECARY SHELF — mounted planks of jars, bottles & a pot ───────────
shelf: (b) => {
  const wood='#4a3422', woodHi='#6a4a30', woodLo='#2e2014', clay='#8a5a3a', clayHi='#a8744a';
  const bottle = (x, top, h, tint, k) => (
    <g key={k}>
      <rect x={x} y={top} width="2.6" height={h} rx="0.7" fill={xmix(tint,'#1a1410',0.2)} {...xol(XINK,0.4)}/>
      <rect x={x+0.3} y={top+1} width="0.8" height={h-1.6} fill="#fff" opacity="0.18"/>
      <rect x={x+0.7} y={top-1.6} width="1.2" height="1.8" fill={woodHi} {...xol(XINK,0.3)}/>
    </g>
  );
  return (<>
    {/* two mounted planks + brackets */}
    {[11,21.5].map((y,i)=>(
      <g key={i}>
        <path d={`M6 ${y+2.6} L9.5 ${y+2.6} L6.5 ${y+5.6} Z`} fill={wood} {...xol(XINK,0.4)}/>
        <path d={`M26 ${y+2.6} L22.5 ${y+2.6} L25.5 ${y+5.6} Z`} fill={wood} {...xol(XINK,0.4)}/>
        <rect x="4.5" y={y} width="23" height="2.6" fill={wood} {...xol()}/>
        <rect x="4.5" y={y} width="23" height="0.8" fill={woodHi} opacity="0.7"/>
      </g>
    ))}
    {/* top shelf — bottles + a round jar */}
    {bottle(8, 5.4, 5.6, b.ambient, 'b1')}
    {bottle(11.4, 6.4, 4.6, '#8aa0c0', 'b2')}
    {bottle(14.8, 4.8, 6.2, b.torch, 'b3')}
    <ellipse cx="21" cy="8.4" rx="2.9" ry="2.6" fill={clay} {...xol()}/>
    <ellipse cx="21" cy="6.6" rx="2.9" ry="0.9" fill={clayHi} opacity="0.6"/>
    <rect x="19.7" y="5.4" width="2.6" height="1.4" fill={clayHi} {...xol(XINK,0.3)}/>
    {/* bottom shelf — clay pot + stacked books */}
    <path d="M7.5 21.5 Q7.5 16.4 11 16.4 Q14.5 16.4 14.5 21.5 Z" fill={clay} {...xol()}/>
    <path d="M7.5 21.5 Q7.5 16.4 11 16.4 Q9 17.4 9 21.5 Z" fill="#000" opacity="0.18"/>
    <ellipse cx="11" cy="16.4" rx="3.5" ry="1" fill={clayHi} {...xol(XINK,0.3)}/>
    <rect x="17" y="19.4" width="8" height="2.1" fill={xmix(b.ambient,'#000',0.25)} {...xol(XINK,0.4)}/>
    <rect x="17.6" y="17.4" width="7.4" height="2.1" fill={xmix(b.torch,'#000',0.3)} {...xol(XINK,0.4)}/>
    <rect x="17.6" y="17.4" width="7.4" height="0.6" fill={woodHi} opacity="0.5"/>
  </>);
},

// ── MOSS & VINES — hanging growth softening the stone ────────────────────
moss_vines: (b) => {
  const mossLo='#3a4a24', moss='#5a7a30', mossHi='#86a84a';
  // bias the moss toward the biome ambient a touch so it reads native
  const tint = (c)=>xmix(c, b.ambient, 0.12);
  return (<>
    {/* top ledge it grows from */}
    <rect x="3" y="5" width="26" height="2.4" fill={tint(mossLo)} {...xol(XINK,0.5)}/>
    <rect x="3" y="5" width="26" height="0.8" fill={tint(mossHi)} opacity="0.7"/>
    {/* dangling strands */}
    {[6,10,14,19,23,27].map((x,i)=>{
      const len = 9 + ((i*5)%11);
      return (
        <g key={i}>
          <path d={`M${x} 7 Q${x+ (i%2?2:-2)} ${7+len*0.6} ${x+(i%2?-1:1)} ${7+len}`} fill="none" stroke={tint(moss)} strokeWidth="1.6"/>
          <path d={`M${x} 7 Q${x+ (i%2?2:-2)} ${7+len*0.6} ${x+(i%2?-1:1)} ${7+len}`} fill="none" stroke={tint(mossHi)} strokeWidth="0.5" opacity="0.6"/>
          {/* leaf nubs */}
          {[0.4,0.7].map((f,j)=>(
            <ellipse key={j} cx={x+(i%2?1.6:-1.6)*f} cy={7+len*f} rx="1.3" ry="0.8" fill={tint(j?mossHi:moss)} {...xol(XINK,0.3)}/>
          ))}
        </g>
      );
    })}
    {/* moss clumps on the ledge */}
    {[7,15,24].map((x,i)=>(
      <ellipse key={i} cx={x} cy="5" rx="3" ry="1.4" fill={tint(mossHi)} opacity="0.8" {...xol(XINK,0.3)}/>
    ))}
  </>);
},

// ── CRATE & BARREL — stacked storage supplies ───────────────────────────
supply_crate: () => {
  const wood='#5a3e26', woodHi='#7a5636', woodLo='#34240f', hoop='#4a4650', hoopHi='#7a7686';
  return (<>
    <ellipse cx="16" cy="28.5" rx="12" ry="2.2" fill="#000" opacity="0.28"/>
    {/* crate */}
    <rect x="4" y="14" width="13" height="13" fill={wood} {...xol()}/>
    <rect x="4" y="14" width="13" height="1" fill={woodHi} opacity="0.7"/>
    <rect x="4" y="14" width="1.3" height="13" fill={woodLo}/>
    <rect x="4" y="14" width="13" height="2" fill={woodLo} opacity="0.45"/>
    <rect x="4" y="25" width="13" height="2" fill={woodLo} opacity="0.45"/>
    <path d="M5 16 L16 25 M16 16 L5 25" stroke={woodLo} strokeWidth="1.3"/>
    <path d="M5 16 L16 25 M16 16 L5 25" stroke={woodHi} strokeWidth="0.4" opacity="0.5"/>
    {/* barrel */}
    <path d="M18 14 Q16.4 20.5 18 27 L26 27 Q27.6 20.5 26 14 Z" fill={wood} {...xol()}/>
    <path d="M18 14 Q16.4 20.5 18 27 L21 27 Q19.7 20.5 21 14 Z" fill="#000" opacity="0.16"/>
    <ellipse cx="22" cy="14" rx="4" ry="1.2" fill={woodHi} {...xol(XINK,0.4)}/>
    <ellipse cx="22" cy="14" rx="2.4" ry="0.6" fill={woodLo}/>
    {[17.3,20.6,24].map((y,i)=>(
      <path key={i} d={`M17.2 ${y} Q22 ${y+1.1} 26.8 ${y}`} fill="none" stroke={hoop} strokeWidth="1"/>
    ))}
    <circle cx="19" cy="17.6" r="0.4" fill={hoopHi} opacity="0.7"/>
  </>);
},

// ── CANDELABRA — a branched iron stand of guttering candles ──────────────
candelabra: (b, a) => {
  const iron='#2e2a32', ironHi='#56505e', wax='#d8cba0';
  return (<>
    <ellipse cx="16" cy="28.5" rx="7" ry="2" fill="#000" opacity="0.3"/>
    {/* base + stem */}
    <path d="M12 28 L20 28 L18.5 25 L13.5 25 Z" fill={iron} {...xol()}/>
    <rect x="15.2" y="11" width="1.6" height="14.5" fill={iron} {...xol(XINK,0.4)}/>
    <rect x="15.2" y="11" width="0.6" height="14.5" fill={ironHi} opacity="0.6"/>
    {/* arms */}
    <path d="M16 14 Q10 13 9 9" fill="none" stroke={iron} strokeWidth="1.4"/>
    <path d="M16 14 Q22 13 23 9" fill="none" stroke={iron} strokeWidth="1.4"/>
    {/* cups + candles */}
    {[[9,9],[16,8.5],[23,9]].map(([cx,cy],i)=>(
      <g key={i}>
        <rect x={cx-1.5} y={cy} width="3" height="1" fill={ironHi} {...xol(XINK,0.3)}/>
        <rect x={cx-1} y={cy-3.5} width="2" height="3.5" fill={wax} {...xol(XINK,0.3)}/>
        <rect x={cx-1} y={cy-3.5} width="0.7" height="3.5" fill="#fff" opacity="0.3"/>
        {xFlame(cx, cy-7, 1.3, b.torch, a, 'c'+i)}
      </g>
    ))}
    <ellipse cx="16" cy="6" rx="11" ry="6" fill={b.torch} opacity="0.1" style={xgl(b.torch,3)}>
      {a && <animate attributeName="opacity" values="0.05;0.14;0.05" dur="1.6s" repeatCount="indefinite"/>}
    </ellipse>
  </>);
},

// ── CAVE MUSHROOMS — a clump of glowing fungi, biome-tinted caps ─────────
mushroom_cluster: (b, a) => {
  const stalk='#cabfa8', stalkLo='#9a8e74';
  const cap = xmix(b.ambient, '#d0c0a0', 0.4);
  const capHi = xmix(b.ambient, '#ffffff', 0.45);
  return (<>
    <ellipse cx="16" cy="28" rx="11" ry="2.2" fill="#000" opacity="0.25"/>
    {[[10,28,2.0,5],[16,28,3.0,8.5],[21,28,2.4,6],[24.5,28,1.4,3.5]].map(([x,base,r,h],i)=>(
      <g key={i}>
        <path d={`M${x-r*0.45} ${base} Q${x-r*0.5} ${base-h} ${x} ${base-h} Q${x+r*0.5} ${base-h} ${x+r*0.45} ${base} Z`} fill={stalk} {...xol(XINK,0.4)}/>
        <path d={`M${x-r*0.45} ${base} Q${x-r*0.5} ${base-h} ${x} ${base-h} L${x} ${base} Z`} fill={stalkLo} opacity="0.5"/>
        <path d={`M${x-r} ${base-h} Q${x} ${base-h-r*1.2} ${x+r} ${base-h} Q${x} ${base-h+r*0.55} ${x-r} ${base-h} Z`} fill={cap} {...xol()} style={xgl(b.ambient,1.5)}/>
        <ellipse cx={x-r*0.3} cy={base-h-r*0.35} rx={r*0.4} ry={r*0.25} fill={capHi} opacity="0.6"/>
        <circle cx={x} cy={base-h-r*0.2} r="0.5" fill={capHi} opacity="0.7"/>
        <circle cx={x+r*0.4} cy={base-h+0.2} r="0.4" fill={capHi} opacity="0.6"/>
      </g>
    ))}
    {/* spore glow */}
    <ellipse cx="16" cy="22" rx="11" ry="6" fill={b.ambient} opacity="0.1" style={xgl(b.ambient,3)}>
      {a && <animate attributeName="opacity" values="0.05;0.14;0.05" dur="3s" repeatCount="indefinite"/>}
    </ellipse>
  </>);
},

};

const DECOR_X_META = {
  weapon_rack:  { name:'Weapon Rack',  note:'salvaged arms · room wall' },
  alcove_urn:   { name:'Alcove Urn',   note:'niche + soul-flame · biome glow' },
  hanging_cage: { name:'Hanging Cage', note:'swaying iron gibbet + bones' },
  shelf:        { name:'Apothecary Shelf', note:'planks of jars & pots' },
  moss_vines:   { name:'Moss & Vines', note:'hanging growth · biome-tinted' },
  supply_crate: { name:'Crate & Barrel', note:'stacked storage supplies' },
  candelabra:   { name:'Candelabra',   note:'branched candles · biome flame' },
  mushroom_cluster: { name:'Cave Mushrooms', note:'glowing fungi · biome-tinted' },
};

const DECOR_X_ORDER = ['shelf','moss_vines','supply_crate','candelabra','mushroom_cluster'];

function DecorX({ kind='shelf', biome, size=104, animate=true, style }) {
  const fn = DECOR_X[kind] || DECOR_X.shelf;
  const b = biome || (window.BIOMES_F ? window.BIOMES_F[0] : { stone:['#4a4452','#211d27'], cap:'#9a8c98', ambient:'#4a7eb8', torch:'#b8935a' });
  return (
    <div style={{ display:'inline-block', lineHeight:0, ...(style||{}) }}>
      <svg width={size} height={size} viewBox="0 0 32 32"
        style={{ display:'block', overflow:'visible',
          filter:`drop-shadow(0 ${size/28}px ${size/22}px rgba(0,0,0,0.55))` }}>
        {fn(b, animate)}
      </svg>
    </div>
  );
}

function biomeFromDef(def = {}) {
  const stone = def.wallPalette || ['#4a4452', '#211d27'];
  const ambientByBiome = {
    forgotten_crypts: '#4a7eb8',
    bone_garden: '#c4503a',
    frozen_halls: '#7faafa',
    sunken_forest: '#88c656',
    iron_stronghold: '#ff8844',
    sun_cursed_sands: '#ffaa44',
    mirror_vaults: '#d4ac6c',
    magma_foundry: '#ff5530',
    drowned_catacombs: '#6acaba',
    void_sanctum: '#9a40e8'
  };
  return {
    stone,
    cap: stone[0] || '#9a8c98',
    ambient: ambientByBiome[def.biomeId] || '#4a7eb8',
    torch: def.biomeId === 'frozen_halls' ? '#bfd6ff'
      : def.biomeId === 'void_sanctum' ? '#c08aff'
      : def.biomeId === 'magma_foundry' ? '#ffa040'
      : '#d4ac6c'
  };
}

const DECOR_X_OVERSCAN = 0.1;
const decorXKey = (kind, def = {}) => `decorx:${kind}:${def.biomeId || 'default'}:${(def.wallPalette || []).join(',')}`;

export function decorXSVG(kind = 'shelf', def = {}, px = 256) {
  const fn = DECOR_X[kind] || DECOR_X.shelf;
  const b = biomeFromDef(def);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 38 38" width="${px}" height="${px}" style="overflow:visible">`
    + fn(b, false)
    + `</svg>`;
}

export function drawVectorDecorX(ctx, x, y, size, kind, def) {
  const key = decorXKey(kind, def);
  return rasterDraw(ctx, x, y, size, key, () => decorXSVG(kind, def, 256), DECOR_X_OVERSCAN);
}

export function preloadDecorXArt() {
  for (const kind of DECOR_X_ORDER) rasterPreload(decorXKey(kind, {}), () => decorXSVG(kind, {}, 256));
}

export { DECOR_X, DECOR_X_META, DECOR_X_ORDER };

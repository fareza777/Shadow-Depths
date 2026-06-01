// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Stair Down  v2  (legibility pass)
//  ────────────────────────────────────────────────────────────────────
//  The old tile read as concentric squares — ambiguous from above. v2 reads
//  unmistakably as a STAIRCASE DESCENDING: a framed stone mouth with a real
//  flight of treads stepping down-and-back into a glowing throat, a bold
//  pulsing down-chevron, and two flanking torches. Re-themes from any biome
//  palette (stone · cap · ambient · torch), like every fixture.
//
//  Drop-in (same call shape as the old fixture):
//    <StairV2 biome={BIOMES_F[i]} size={120} animate />
//
//  Maps to  tile_stairs_down  /  drawStairsDownTile() — hand to Claude Code
//  to replace the body of that renderer.
// ═══════════════════════════════════════════════════════════════════════
import { h, Fragment } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const SINK = '#08070c';
const _shex = (c)=>{c=c.replace('#','');return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];};
const smix = (a,b,t)=>{const A=_shex(a),B=_shex(b);const m=A.map((v,i)=>Math.round(v+(B[i]-v)*t));return `rgb(${m[0]},${m[1]},${m[2]})`;};
const sol = (c=SINK,w=0.6)=>({ stroke:c, strokeWidth:w, strokeLinejoin:'round', strokeLinecap:'round' });
const sgl = (col,r=2)=>({ filter:`drop-shadow(0 0 ${r}px ${col})` });

function StairDownV2(b, animate) {
  const [sl, sd] = b.stone;
  const jambL = smix(sl, sd, 0.25);   // lit left jamb
  const jambR = sd;                    // shadowed right jamb
  const lintel = smix(b.cap, sd, 0.25);

  // A flight of treads. Each step sits LOWER and is drawn as a bright tread
  // (top face, catching light) over a dark riser — the classic stair read —
  // and each is slightly NARROWER so the flight recedes into the throat.
  const steps = [
    { y: 8.5,  w: 18.0 },
    { y: 12.2, w: 15.4 },
    { y: 15.9, w: 12.8 },
    { y: 19.6, w: 10.2 },
    { y: 23.3, w: 7.6  },
  ];

  return (<>
    {/* ── stone doorway frame so the opening reads as a stairwell mouth ── */}
    <path d="M3 4 L29 4 L29 29 L3 29 Z" fill={sd} {...sol()}/>
    {/* lit lintel across the top */}
    <path d="M3 4 L29 4 L29 7.5 L3 7.5 Z" fill={lintel} {...sol(SINK,0.5)}/>
    <rect x="3" y="4" width="26" height="1" fill={smix(b.cap,'#fff',0.2)} opacity="0.6"/>
    {/* keystone */}
    <path d="M14 4 L18 4 L17 7.5 L15 7.5 Z" fill={smix(b.cap,sd,0.1)} {...sol(SINK,0.4)}/>
    {/* left + right jambs */}
    <path d="M3 7.5 L7 7.5 L7 29 L3 29 Z" fill={jambL} {...sol(SINK,0.5)}/>
    <path d="M25 7.5 L29 7.5 L29 29 L25 29 Z" fill={jambR} {...sol(SINK,0.5)}/>
    <rect x="3" y="7.5" width="1" height="21.5" fill={smix(sl,'#fff',0.15)} opacity="0.5"/>
    <rect x="24.4" y="7.5" width="0.8" height="21.5" fill="#000" opacity="0.35"/>

    {/* ── the dark shaft the stair descends into ── */}
    <path d="M7 7.5 L25 7.5 L25 29 L7 29 Z" fill="#05040a"/>

    {/* glowing throat at the very bottom — the light the hero walks toward */}
    <rect x="11" y="25.5" width="10" height="3.5" fill={b.ambient} style={sgl(b.ambient,2)}>
      {animate && <animate attributeName="opacity" values="0.7;1;0.7" dur="2.6s" repeatCount="indefinite"/>}
    </rect>
    <rect x="12.6" y="26.4" width="6.8" height="2.6" fill={smix(b.ambient,'#000',0.45)}/>

    {/* ── the flight of steps (drawn back-to-front so fronts overlap) ── */}
    {steps.map((st,i)=>{
      const t = i/(steps.length-1);
      const x = 16 - st.w/2;
      const riser = smix(sl, sd, 0.45 + t*0.4);       // vertical face, darker deeper
      const tread = smix(b.cap, riser, 0.35 - t*0.18);// top of step, lit, dims with depth
      return (
        <g key={i}>
          {/* riser (the vertical drop, in shadow) */}
          <rect x={x} y={st.y+1.4} width={st.w} height={3.0} fill={riser} {...sol(SINK,0.45)}/>
          <rect x={x} y={st.y+4.0} width={st.w} height={0.6} fill="#000" opacity="0.45"/>
          {/* tread (the flat top you step on, catching the light) */}
          <rect x={x} y={st.y} width={st.w} height={1.6} fill={tread} {...sol(SINK,0.4)}/>
          <rect x={x} y={st.y} width={st.w} height={0.5} fill={smix(tread,'#fff',0.3)} opacity="0.7"/>
        </g>
      );
    })}

    {/* up-glow bleeding from the throat over the lowest steps */}
    <rect x="9" y="20" width="14" height="9" fill={b.ambient} opacity="0.16" style={sgl(b.ambient,3)}>
      {animate && <animate attributeName="opacity" values="0.08;0.22;0.08" dur="3s" repeatCount="indefinite"/>}
    </rect>

    {/* ── bold DOWN chevron on the top tread — the unmistakable cue ── */}
    <g style={sgl(b.ambient,2)}>
      <path d="M12 9.6 L16 12.6 L20 9.6 L18.4 9.6 L16 11.4 L13.6 9.6 Z" fill={b.cap}>
        {animate && <animate attributeName="opacity" values="0.55;1;0.55" dur="1.6s" repeatCount="indefinite"/>}
      </path>
      <path d="M13.4 11.8 L16 13.8 L18.6 11.8 L17.4 11.8 L16 12.9 L14.6 11.8 Z" fill={b.cap} opacity="0.55"/>
    </g>

    {/* ── two guttering torches on the jambs ── */}
    {[5, 27].map((tx,k)=>(
      <g key={k}>
        <rect x={tx-0.7} y="11" width="1.4" height="6" fill="#3a2a18" {...sol(SINK,0.4)}/>
        <path d={`M${tx} 11 Q${tx-1.6} 8 ${tx} 5.6 Q${tx+1.6} 8 ${tx} 11 Z`} fill={b.torch} style={sgl(b.torch,2)}>
          {animate && <animate attributeName="opacity" values="0.7;1;0.7" dur={`${1+k*0.3}s`} repeatCount="indefinite"/>}
        </path>
        <ellipse cx={tx} cy="8" rx="0.7" ry="1.2" fill="#fff3d0"/>
      </g>
    ))}
  </>);
}

function StairV2({ biome, size = 120, animate = true, style }) {
  const b = biome || (window.BIOMES_F ? window.BIOMES_F[0] : { stone:['#4a4452','#211d27'], cap:'#9a8c98', ambient:'#4a7eb8', torch:'#b8935a' });
  return (
    <div style={{ display:'inline-block', lineHeight:0, ...(style||{}) }}>
      <svg width={size} height={size} viewBox="0 0 32 32"
        style={{ display:'block', overflow:'visible',
          filter:`drop-shadow(0 ${size/26}px ${size/20}px rgba(0,0,0,0.6))` }}>
        <ellipse cx="16" cy="30" rx="12" ry="2" fill="#000" opacity="0.35"/>
        {StairDownV2(b, animate)}
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

const STAIR_OVERSCAN = 0.08;
const stairKey = (def = {}) => `stair:v2:${def.biomeId || 'default'}:${(def.wallPalette || []).join(',')}`;

export function stairDownSVG(def = {}, px = 256) {
  const b = biomeFromDef(def);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 36 36" width="${px}" height="${px}" style="overflow:visible">`
    + `<ellipse cx="16" cy="30" rx="12" ry="2" fill="#000" opacity="0.35"/>`
    + StairDownV2(b, false)
    + `</svg>`;
}

export function drawVectorStairsDown(ctx, x, y, size, def) {
  const key = stairKey(def);
  return rasterDraw(ctx, x, y, size, key, () => stairDownSVG(def, 256), STAIR_OVERSCAN);
}

export function preloadStairArt() {
  rasterPreload(stairKey({}), () => stairDownSVG({}, 256));
}

export { StairDownV2 };

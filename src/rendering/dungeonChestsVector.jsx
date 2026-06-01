// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Loot Chests  (rarity tiers · closed / open · + mimic)
//  ────────────────────────────────────────────────────────────────────
//  The reward a hero kneels at. One chest silhouette escalated across four
//  rarity tiers — wood → iron → gilded → runed — so the *value inside* is
//  legible before it's opened, plus a Mimic that wears the same shape until
//  it bites. Same idiom as every engine: 32-grid SVG, ink outlines, multi-
//  tone shading, rarity-tinted glow, struck-light highlights, drop-shadow.
//
//  Drop-in:
//    <Chest tier="gold"  open={false} size={120} animate />
//    <Chest tier="runed" open size={120} animate />
//    <Chest tier="mimic" size={120} animate />
//
//  Maps to Renderer._drawChestSprite() / the 'mystery_chest' interactable.
//  Tier glow matches the Armory rarity ramp (common→epic).
// ═══════════════════════════════════════════════════════════════════════
import { h, Fragment } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const CINK = '#08070c';
const _chex = (c)=>{c=c.replace('#','');return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];};
const cmix = (a,b,t)=>{const A=_chex(a),B=_chex(b);const m=A.map((v,i)=>Math.round(v+(B[i]-v)*t));return `rgb(${m[0]},${m[1]},${m[2]})`;};
const col_ = (c=CINK,w=0.6)=>({ stroke:c, strokeWidth:w, strokeLinejoin:'round', strokeLinecap:'round' });
const cgl = (col,r=2)=>({ filter:`drop-shadow(0 0 ${r}px ${col})` });

// per-tier materials: wood/body tone, the metal trim, and the rarity glow
const TIERS = {
  wood:  { wood:'#6e4228', woodLo:'#4a2c18', woodHi:'#8a5836', metal:'#7a6a4a', metalHi:'#b8a070', glow:'#8a8068', label:'COMMON' },
  iron:  { wood:'#4a3a2e', woodLo:'#2e241c', woodHi:'#62503e', metal:'#52555e', metalHi:'#9aa0aa', glow:'#6aa84a', label:'UNCOMMON' },
  gold:  { wood:'#6a4a26', woodLo:'#452e16', woodHi:'#86602e', metal:'#c89a3e', metalHi:'#ffe39a', glow:'#5a86d8', label:'RARE' },
  runed: { wood:'#3a2c4a', woodLo:'#231a30', woodHi:'#4e3c64', metal:'#7a5ea8', metalHi:'#c8a8f0', glow:'#b072e0', label:'EPIC' },
};

// ── shared body (the wooden box + metal straps) ─────────────────────────
function chestBody(T) {
  return (<>
    {/* body box (slight taper) */}
    <path d="M6 16 L26 16 L24.5 27 L7.5 27 Z" fill={T.wood} {...col_()}/>
    {/* lit front edge + shaded base */}
    <path d="M6 16 L26 16 L25.6 17.4 L6.4 17.4 Z" fill={T.woodHi} opacity="0.7"/>
    <path d="M6 16 L7.5 27 L13 27 L12 16 Z" fill="#000" opacity="0.12"/>
    <path d="M7.5 27 L24.5 27 L24 28 L8 28 Z" fill={T.woodLo}/>
    {/* plank seams */}
    {[12,16,20].map((x,i)=><line key={i} x1={x} y1="16.6" x2={x-0.3} y2="26.6" stroke={CINK} strokeWidth="0.3" opacity="0.4"/>)}
    {/* vertical metal straps */}
    {[9.5,22.5].map((x,i)=>(
      <g key={i}>
        <path d={`M${x-1.3} 16 L${x+1.3} 16 L${x+1.1} 27 L${x-1.1} 27 Z`} fill={T.metal} {...col_(CINK,0.4)}/>
        <rect x={x-1.1} y="16" width="0.7" height="11" fill={T.metalHi} opacity="0.6"/>
        <circle cx={x} cy="18" r="0.6" fill={T.metalHi}/>
        <circle cx={x} cy="25" r="0.6" fill={T.metalHi}/>
      </g>
    ))}
    {/* lower rim band */}
    <rect x="6.6" y="24.2" width="18.8" height="1.6" fill={T.metal} {...col_(CINK,0.3)} transform="skewX(-3)" opacity="0.95"/>
  </>);
}

// ── lid, closed (domed) ─────────────────────────────────────────────────
function lidClosed(T, tier) {
  return (<>
    <path d="M6 16 L6 13 Q6 8 16 8 Q26 8 26 13 L26 16 Z" fill={T.wood} {...col_()}/>
    <path d="M6 16 L6 13 Q6 8 16 8 Q12 8.6 10 12 L10 16 Z" fill="#000" opacity="0.14"/>
    <path d="M7 12 Q16 9.4 25 12" fill="none" stroke={T.woodHi} strokeWidth="0.9" opacity="0.6"/>
    {/* lid straps continue */}
    {[9.5,22.5].map((x,i)=>(
      <path key={i} d={`M${x-1.3} 16 L${x-1.3} 13 Q${x-1.3} 10.4 ${x} 10.2 Q${x+1.3} 10.4 ${x+1.3} 13 L${x+1.3} 16 Z`}
        fill={T.metal} {...col_(CINK,0.4)}/>
    ))}
    {/* rim band where lid meets body */}
    <rect x="5.6" y="15.2" width="20.8" height="2" fill={T.metal} {...col_(CINK,0.4)}/>
    <rect x="5.6" y="15.2" width="20.8" height="0.7" fill={T.metalHi} opacity="0.7"/>
    {/* lock plate */}
    <rect x="14" y="14" width="4" height="4.2" rx="0.5" fill={T.metalHi} {...col_(CINK,0.4)}/>
    <rect x="15.4" y="15.6" width="1.2" height="2" fill={CINK}/>
    {/* tier flourish on the lid */}
    {tier==='gold' && <path d="M13 11 L16 9.5 L19 11 L18 12.6 L14 12.6 Z" fill={T.metalHi} {...col_(CINK,0.3)} style={cgl(T.metalHi,1)}/>}
    {tier==='runed' && <g style={cgl(T.glow,2)}>
      <circle cx="16" cy="11.4" r="1.5" fill="none" stroke={T.metalHi} strokeWidth="0.6"/>
      <path d="M16 10.1 L16 12.7 M14.7 11.4 L17.3 11.4" stroke={T.metalHi} strokeWidth="0.5"/>
    </g>}
  </>);
}

// ── lid, open (hinged back) + treasure light pouring out ────────────────
function lidOpen(T, a) {
  return (<>
    {/* interior cavity */}
    <path d="M6.6 16.4 L25.4 16.4 L24.5 26.6 L7.5 26.6 Z" fill="#0a0808"/>
    {/* glow from within */}
    <ellipse cx="16" cy="17" rx="9" ry="5" fill={T.glow} opacity="0.5" style={cgl(T.glow,4)}>
      {a && <animate attributeName="opacity" values="0.35;0.65;0.35" dur="2.2s" repeatCount="indefinite"/>}
    </ellipse>
    <ellipse cx="16" cy="18" rx="6.4" ry="3" fill="#fff6d8" opacity="0.55"/>
    {/* the hinged-back lid behind the rim */}
    <path d="M6 9 L26 9 Q26 4 16 4 Q6 4 6 9 Z" fill={cmix(T.wood,'#000',0.15)} {...col_()}/>
    <path d="M7 7 Q16 4.6 25 7" fill="none" stroke={T.woodHi} strokeWidth="0.8" opacity="0.5"/>
    <rect x="5.6" y="8.2" width="20.8" height="1.8" fill={T.metal} {...col_(CINK,0.4)}/>
    {/* rim of the open body */}
    <rect x="5.6" y="15.4" width="20.8" height="2" fill={T.metal} {...col_(CINK,0.4)}/>
    <rect x="5.6" y="15.4" width="20.8" height="0.7" fill={T.metalHi} opacity="0.7"/>
    {/* loot motes rising */}
    {[[12,15,0.6],[16,14,0.7],[20,15,0.6],[14,13,0.5],[18,13,0.5]].map(([x,y,r],i)=>(
      <circle key={i} cx={x} cy={y} r={r} fill={i%2?'#fff6d8':T.metalHi} style={cgl(T.glow,2)}>
        {a && <><animate attributeName="cy" values={`${y};${y-5};${y}`} dur={`${1.8+i*0.35}s`} repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0;1" dur={`${1.8+i*0.35}s`} repeatCount="indefinite"/></>}
      </circle>
    ))}
    {/* a hint of gold coins / gem in the cavity */}
    <ellipse cx="16" cy="20.5" rx="5" ry="1.8" fill={T.metalHi} opacity="0.85" style={cgl(T.glow,1)}/>
    <path d="M15 19.5 L16 18 L17 19.5 L16 20.6 Z" fill="#fff6d8" style={cgl(T.glow,2)}/>
  </>);
}

// ── MIMIC — the chest that bites back ───────────────────────────────────
function mimic(a) {
  const wood='#5a3a26', woodHi='#7a4e34', tongue='#a8324a', tooth='#efe6cc';
  return (<>
    {/* lower jaw / body */}
    <path d="M6 17 L26 17 L24.5 27 L7.5 27 Z" fill={wood} {...col_()}/>
    <path d="M6 17 L26 17 L25.6 18.4 L6.4 18.4 Z" fill={woodHi} opacity="0.7"/>
    {/* gaping maw */}
    <path d="M7 17 L25 17 L22 22 Q16 24.5 10 22 Z" fill="#1a0a0c"/>
    {/* tongue */}
    <path d="M12 21 Q16 26 20 21 Q16 23 12 21 Z" fill={tongue} {...col_(CINK,0.4)}/>
    <path d="M14.5 21.5 Q16 23.5 17.5 21.5" fill="none" stroke="#6e1f30" strokeWidth="0.5"/>
    {/* lower fangs */}
    {[9,12,15,18,21,23].map((x,i)=>(
      <path key={i} d={`M${x} 17.4 L${x+1.3} 17.4 L${x+0.65} ${20.2 - (i%2)*0.6} Z`} fill={tooth} {...col_(CINK,0.3)}/>
    ))}
    {/* the hinged lid, snarling up */}
    <path d="M6 17 L6 13 Q6 8 16 8 Q26 8 26 13 L26 17 Z" fill={wood} {...col_()}/>
    <path d="M6 17 L6 13 Q6 8 16 8 Q11 8.6 9 13 L9 17 Z" fill="#000" opacity="0.15"/>
    {/* upper fangs hanging down */}
    {[9,12,15,18,21,23].map((x,i)=>(
      <path key={i} d={`M${x} 16.6 L${x+1.3} 16.6 L${x+0.65} ${13.8 + (i%2)*0.6} Z`} fill={tooth} {...col_(CINK,0.3)}/>
    ))}
    {/* eyes */}
    {[11.5,20.5].map((x,i)=>(
      <g key={i}>
        <ellipse cx={x} cy="11.5" rx="2" ry="2.2" fill="#f4eecf" {...col_(CINK,0.4)}/>
        <circle cx={x+0.2} cy="11.8" r="1" fill="#c4503a" style={cgl('#ff6a4a',2)}>
          {a && <animate attributeName="r" values="0.9;1.15;0.9" dur="1.6s" repeatCount="indefinite"/>}
        </circle>
        <circle cx={x+0.5} cy="11.4" r="0.35" fill="#fff"/>
      </g>
    ))}
    {/* a tongue-flick glint + lure: a fake coin on the tongue */}
    <circle cx="16" cy="22" r="1" fill="#ffe39a" style={cgl('#ffd070',2)}>{a && <animate attributeName="opacity" values="0.6;1;0.6" dur="1.4s" repeatCount="indefinite"/>}</circle>
  </>);
}

const CHEST_META = {
  wood:  { name:'Wooden Chest', note:'common drops · plain iron corners' },
  iron:  { name:'Iron-Bound Chest', note:'uncommon · banded, heavier lock' },
  gold:  { name:'Gilded Chest', note:'rare · brass trim + crest' },
  runed: { name:'Runed Reliquary', note:'epic · arcane seal, it hums' },
  mimic: { name:'Mimic', note:'wears the chest until you reach in' },
};

function Chest({ tier='wood', open=false, size=120, animate=true, style }) {
  const isMimic = tier === 'mimic';
  const T = TIERS[tier] || TIERS.wood;
  return (
    <div style={{ display:'inline-block', lineHeight:0, ...(style||{}) }}>
      <svg width={size} height={size} viewBox="0 0 32 32"
        style={{ display:'block', overflow:'visible',
          filter:`drop-shadow(0 ${size/24}px ${size/18}px rgba(0,0,0,0.55))` }}>
        <ellipse cx="16" cy="28.5" rx="11" ry="2.4" fill="#000" opacity="0.35"/>
        {/* rarity aura (skip for closed wood / mimic) */}
        {!isMimic && (open || tier!=='wood') &&
          <ellipse cx="16" cy="17" rx="13" ry="11" fill={T.glow} opacity={open?0.16:0.1} style={cgl(T.glow,3)}>
            {animate && <animate attributeName="opacity" values={`${open?0.1:0.05};${open?0.22:0.14};${open?0.1:0.05}`} dur="2.8s" repeatCount="indefinite"/>}
          </ellipse>}
        {isMimic ? mimic(animate) : (
          open ? (<>{chestBody(T)}{lidOpen(T, animate)}</>)
               : (<>{chestBody(T)}{lidClosed(T, tier)}</>)
        )}
      </svg>
    </div>
  );
}

const CHEST_OVERSCAN = 0.12;
const chestKey = (tier, open) => `chest:${tier}:${open ? 'open' : 'closed'}`;

export function chestSVG(tier = 'wood', open = false, px = 256) {
  const isMimic = tier === 'mimic';
  const T = TIERS[tier] || TIERS.wood;
  const body = isMimic
    ? mimic(false)
    : open
      ? `${chestBody(T)}${lidOpen(T, false)}`
      : `${chestBody(T)}${lidClosed(T, tier)}`;
  const aura = !isMimic && (open || tier !== 'wood')
    ? `<ellipse cx="16" cy="17" rx="13" ry="11" fill="${T.glow}" opacity="${open ? 0.16 : 0.1}" style="filter:drop-shadow(0 0 3px ${T.glow})"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 38 38" width="${px}" height="${px}" style="overflow:visible">`
    + `<ellipse cx="16" cy="28.5" rx="11" ry="2.4" fill="#000" opacity="0.35"/>`
    + aura
    + body
    + `</svg>`;
}

export function drawVectorChest(ctx, x, y, size, tier = 'wood', open = false) {
  const key = chestKey(tier, open);
  return rasterDraw(ctx, x, y, size, key, () => chestSVG(tier, open, 256), CHEST_OVERSCAN);
}

export function preloadChestArt() {
  for (const tier of Object.keys({ ...TIERS, mimic: true })) {
    rasterPreload(chestKey(tier, false), () => chestSVG(tier, false, 256));
    if (tier !== 'mimic') rasterPreload(chestKey(tier, true), () => chestSVG(tier, true, 256));
  }
}

export { CHEST_META, TIERS };

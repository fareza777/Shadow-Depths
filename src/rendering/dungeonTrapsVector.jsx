// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Floor Traps  (the four armed hazards + the trigger plate)
//  ────────────────────────────────────────────────────────────────────
//  The hidden one-shot traps scattered on a floor. They reveal when the hero
//  steps adjacent — so they read as a *decision* (step over / route around),
//  not a gotcha — and spring when anything walks onto an armed one.
//
//  Same illustration idiom as every other engine: 32-grid SVG, ink outlines
//  (#08070c), multi-tone shading, glow, drop-shadow. Drawn slightly tilted
//  (¾ top-down) so each mechanism reads on the floor.
//
//  Each trap renders in two states the game already tracks:
//    state="armed"   — primed, warning glyph lit
//    state="sprung"  — already discharged, scorched / spent
//
//  Drop-in:
//    <Trap kind="spike" state="armed"  size={120} animate />
//    <Trap kind="flame" state="sprung" size={120} />
//
//  Maps to gameplay/hazards.js HAZARDS  +  Renderer._drawHazards().
//  Colours match the game exactly: spike #cdd5dd · venom #5ac06a ·
//  frost #bcd6ff · flame #ff8844.
// ═══════════════════════════════════════════════════════════════════════
import { h, Fragment } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const TINK = '#08070c';
const _thex = (c)=>{c=c.replace('#','');return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];};
const tmix = (a,b,t)=>{const A=_thex(a),B=_thex(b);const m=A.map((v,i)=>Math.round(v+(B[i]-v)*t));return `rgb(${m[0]},${m[1]},${m[2]})`;};
const tol = (c=TINK,w=0.6)=>({ stroke:c, strokeWidth:w, strokeLinejoin:'round', strokeLinecap:'round' });
const tgl = (col,r=2)=>({ filter:`drop-shadow(0 0 ${r}px ${col})` });

// ── shared: a sunken flagstone recess every trap sits inside ─────────────
const TrapWell = ({ rim='#4a4554', stone='#2a2630', deep='#0a0810' }) => (<>
  {/* outer flagstone with a chamfer so the trap reads as set INTO the floor */}
  <path d="M3 4 L29 4 L28 28 L4 28 Z" fill={stone} {...tol(TINK,0.7)}/>
  <path d="M3 4 L29 4 L27.4 6 L4.6 6 Z" fill={tmix(rim,'#fff',0.15)} opacity="0.5"/>
  <path d="M3 4 L4.6 6 L4 26 L4 28 Z" fill="#000" opacity="0.25"/>
  {/* inner pit */}
  <path d="M6 7 L26 7 L25 25 L7 25 Z" fill={deep} {...tol(TINK,0.5)}/>
  <path d="M6 7 L26 7 L25.4 8.4 L6.6 8.4 Z" fill="#000" opacity="0.55"/>
</>);

// ── warning diamond (matches the in-game reveal glyph) ───────────────────
const WarnDiamond = (col, a) => (
  <path d="M16 2 L24 16 L16 30 L8 16 Z" fill="none" stroke={col} strokeWidth="0.7"
    strokeDasharray="2 2.4" opacity="0.5" style={tgl(col,1.5)}>
    {a && <animate attributeName="opacity" values="0.25;0.6;0.25" dur="1.8s" repeatCount="indefinite"/>}
  </path>
);

const TRAPS = {

// ── SPIKE TRAP — a pit bristling with iron blades ───────────────────────
spike: (a, sprung) => {
  const steelLo='#5a626c', steel='#8f949c', steelHi='#d7d9df';
  // a 3×3 fan of spikes (diamonds) rising out of the dark
  const cols=[10.5,16,21.5], rows = sprung ? [11,16.5,22] : [13,17.5,22];
  const spikes=[];
  rows.forEach((cy,ri)=>cols.forEach((cx,ci)=>{
    const h = sprung ? 5.5 : 3.2;            // sprung = fully extended
    const x = cx + (ci-1)*(ri-1)*0.4;
    spikes.push(
      <g key={`${ri}-${ci}`}>
        <path d={`M${x} ${cy-h} L${x+2} ${cy} L${x} ${cy+1.2} L${x-2} ${cy} Z`} fill={steel} {...tol(TINK,0.4)}/>
        <path d={`M${x} ${cy-h} L${x+2} ${cy} L${x} ${cy} Z`} fill={steelLo}/>
        <path d={`M${x} ${cy-h} L${x-2} ${cy} L${x} ${cy} Z`} fill={steelHi}/>
        {sprung && <circle cx={x} cy={cy-h} r="0.8" fill="#7a1f15" {...tgl('#c4503a',1)}/>}
      </g>
    );
  }));
  return (<>
    <TrapWell/>
    {spikes}
    {/* iron lip rivets */}
    {[[7.2,8],[24.8,8],[7.6,24],[24.4,24]].map(([x,y],i)=>(
      <circle key={i} cx={x} cy={y} r="0.9" fill={steel} {...tol(TINK,0.3)}/>
    ))}
    {!sprung && WarnDiamond('#cdd5dd', a)}
    {!sprung && <ellipse cx="16" cy="16" rx="9" ry="8" fill="#cdd5dd" opacity="0.06" style={tgl('#cdd5dd',2)}/>}
  </>);
},

// ── VENOM VENT — a holed iron plate exhaling poison gas ─────────────────
venom: (a, sprung) => {
  const grate='#3a4438', grateHi='#5a6a52', gas='#5ac06a';
  return (<>
    <TrapWell rim="#3a4438" stone="#26302a" deep="#0a140c"/>
    {/* iron grate plate with bored holes */}
    <path d="M7 8 L25 8 L24 24 L8 24 Z" fill={grate} {...tol(TINK,0.5)}/>
    <path d="M7 8 L25 8 L24.4 9.2 L7.6 9.2 Z" fill={grateHi} opacity="0.7"/>
    {[ [11,12],[16,12],[21,12],[11,16],[16,16],[21,16],[12,20],[16,20],[20,20] ].map(([x,y],i)=>(
      <g key={i}>
        <circle cx={x} cy={y} r="1.4" fill="#0a140c" {...tol(TINK,0.3)}/>
        <circle cx={x} cy={y} r="0.7" fill={sprung?'#1a2a1a':'#0d1d0f'}/>
      </g>
    ))}
    {/* gas plumes */}
    {(sprung?[[12,1.0],[16,1.4],[20,1.0]]:[[16,0.7]]).map(([x,sc],i)=>(
      <g key={i} style={tgl(gas, sprung?3:2)}>
        <ellipse cx={x} cy={sprung?7:9} rx={2.4*sc} ry={2*sc} fill={gas} opacity={sprung?0.4:0.28}>
          {a && <animate attributeName="cy" values={`${sprung?9:9};${sprung?2:5};${sprung?9:9}`} dur={`${2.4+i*0.5}s`} repeatCount="indefinite"/>}
          {a && <animate attributeName="opacity" values="0.45;0;0.45" dur={`${2.4+i*0.5}s`} repeatCount="indefinite"/>}
        </ellipse>
      </g>
    ))}
    {!sprung && WarnDiamond(gas, a)}
  </>);
},

// ── FROST GLYPH — a carved rune ring that flash-freezes ─────────────────
frost: (a, sprung) => {
  const ice='#bcd6ff', iceLo='#6f93c8', glyph= sprung? '#46566e' : ice;
  return (<>
    <TrapWell rim="#2c3850" stone="#1f2838" deep="#0a1018"/>
    {/* carved ring */}
    <circle cx="16" cy="16" r="7.5" fill="none" stroke={glyph} strokeWidth="1" opacity={sprung?0.5:0.9} style={sprung?{}:tgl(ice,2)}>
      {a && !sprung && <animate attributeName="opacity" values="0.6;1;0.6" dur="2.6s" repeatCount="indefinite"/>}
    </circle>
    <circle cx="16" cy="16" r="4.6" fill="none" stroke={glyph} strokeWidth="0.6" opacity={sprung?0.4:0.7}/>
    {/* inner rune — a six-point asterisk */}
    <g stroke={glyph} strokeWidth="0.8" opacity={sprung?0.5:0.95} style={sprung?{}:tgl(ice,2)}>
      {[0,60,120].map((deg,i)=>{const r=4.4, rad=deg*Math.PI/180; const dx=Math.cos(rad)*r, dy=Math.sin(rad)*r;
        return <line key={i} x1={16-dx} y1={16-dy} x2={16+dx} y2={16+dy}/>;})}
    </g>
    {/* frost crystals at cardinal points */}
    {[[16,7.5],[24,16],[16,24.5],[8,16]].map(([x,y],i)=>(
      <path key={i} d={`M${x} ${y-1.4} L${x+1.1} ${y} L${x} ${y+1.4} L${x-1.1} ${y} Z`}
        fill={sprung?iceLo:ice} opacity={sprung?0.6:1} {...tol(TINK,0.3)} style={sprung?{}:tgl(ice,1.5)}/>
    ))}
    {!sprung && <circle cx="16" cy="16" r="9" fill={ice} opacity="0.07" style={tgl(ice,3)}>
      {a && <animate attributeName="opacity" values="0.04;0.12;0.04" dur="2.6s" repeatCount="indefinite"/>}
    </circle>}
  </>);
},

// ── FLAME JET — a floor nozzle that erupts in fire ──────────────────────
flame: (a, sprung) => {
  const iron='#3a3138', ember='#ff8844', emberHi='#ffd86a';
  return (<>
    <TrapWell rim="#3a2820" stone="#2a1c16" deep="#120806"/>
    {/* scorch ring */}
    <circle cx="16" cy="18" r="7.5" fill="#1a0e08" opacity="0.7"/>
    {/* brass nozzle */}
    <path d="M12.5 19 L19.5 19 L18.5 23 L13.5 23 Z" fill={iron} {...tol(TINK,0.5)}/>
    <rect x="13" y="18" width="6" height="1.4" fill={tmix(iron,'#fff',0.3)}/>
    <ellipse cx="16" cy="18" rx="3.4" ry="1.1" fill="#0a0604"/>
    {/* flame */}
    {sprung ? (
      <g style={tgl(ember,3)}>
        <path d="M16 2 Q11 9 13 15 Q9 12 11.5 18 Q12 12 16 8 Q20 12 20.5 18 Q23 12 19 15 Q21 9 16 2 Z" fill={ember}>
          {a && <animate attributeName="opacity" values="0.82;1;0.82" dur="0.5s" repeatCount="indefinite"/>}
        </path>
        <path d="M16 7 Q13.5 12 14.5 16 Q16 13 16 17 Q16 13 17.5 16 Q18.5 12 16 7 Z" fill={emberHi}/>
        {[[12,8,0.5],[20,7,0.5],[16,3,0.4]].map(([sx,sy,r],i)=>(
          <circle key={i} cx={sx} cy={sy} r={r} fill={emberHi}>
            <animate attributeName="cy" values={`${sy};${sy-4};${sy}`} dur={`${1.2+i*0.3}s`} repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0;1" dur={`${1.2+i*0.3}s`} repeatCount="indefinite"/>
          </circle>
        ))}
      </g>
    ) : (
      <g style={tgl(ember,2)}>
        {/* pilot ember — primed but low */}
        <path d="M16 14 Q14 17 15 19 Q16 17.5 16 19.5 Q16 17.5 17 19 Q18 17 16 14 Z" fill={ember}>
          {a && <animate attributeName="opacity" values="0.6;1;0.6" dur="0.7s" repeatCount="indefinite"/>}
        </path>
        {WarnDiamond(ember, a)}
      </g>
    )}
  </>);
},

// ── PRESSURE PLATE — the hidden trigger, before anything springs ────────
pressure_plate: (a, sprung) => {
  const stone='#3a3542', stoneHi='#5a5466', seam='#08070c';
  return (<>
    <TrapWell rim="#4a4554" stone="#2a2630" deep="#1a1620"/>
    {/* the raised plate */}
    <path d={`M8 ${sprung?9.6:8.5} L24 ${sprung?9.6:8.5} L23 24 L9 24 Z`} fill={stone} {...tol(TINK,0.6)}/>
    <path d={`M8 ${sprung?9.6:8.5} L24 ${sprung?9.6:8.5} L23.4 ${sprung?10.8:9.7} L8.6 ${sprung?10.8:9.7} Z`} fill={stoneHi} opacity="0.7"/>
    {!sprung && <path d="M8 8.5 L8.6 9.7 L9 22.5 L8.2 23.5 Z" fill="#000" opacity="0.3"/>}
    {/* seam gap around the plate */}
    <path d="M6.5 7 L25.5 7 L24.5 25 L7.5 25 Z" fill="none" stroke={seam} strokeWidth="0.5" opacity="0.8"/>
    {/* corner studs */}
    {[[10,11],[22,11],[10.6,22],[21.4,22]].map(([x,y],i)=>(
      <circle key={i} cx={x} cy={y} r="0.9" fill={stoneHi} {...tol(TINK,0.3)}/>
    ))}
    {/* centre keyhole / catch */}
    <rect x="15" y="14.5" width="2" height="3" fill={seam}/>
    {sprung
      ? <path d="M11 16 L21 16" stroke="#08070c" strokeWidth="0.6" opacity="0.6"/>
      : WarnDiamond('#b8935a', a)}
  </>);
},

};

const TRAP_META = {
  spike:          { name:'Spike Trap',   hz:'spike', col:'#cdd5dd', note:'iron blades · pure burst' },
  venom:          { name:'Venom Vent',   hz:'venom', col:'#5ac06a', note:'poison gas · +poison 3t' },
  frost:          { name:'Frost Glyph',  hz:'frost', col:'#bcd6ff', note:'carved rune · +slow 2t' },
  flame:          { name:'Flame Jet',    hz:'flame', col:'#ff8844', note:'floor nozzle · +burn 3t' },
  pressure_plate: { name:'Pressure Plate', hz:'—',  col:'#b8935a', note:'the hidden trigger tile' },
};

function Trap({ kind='spike', state='armed', size=120, animate=true, style }) {
  const fn = TRAPS[kind] || TRAPS.spike;
  const sprung = state === 'sprung';
  return (
    <div style={{ display:'inline-block', lineHeight:0, ...(style||{}) }}>
      <svg width={size} height={size} viewBox="0 0 32 32"
        style={{ display:'block', overflow:'visible',
          filter:`drop-shadow(0 ${size/30}px ${size/22}px rgba(0,0,0,0.5))` }}>
        {fn(animate, sprung)}
      </svg>
    </div>
  );
}

const TRAP_OVERSCAN = 0.08;
const trapKey = (kind, state) => `trap:${kind}:${state}`;

export function trapSVG(kind = 'spike', state = 'armed', px = 256) {
  const fn = TRAPS[kind] || TRAPS.spike;
  const sprung = state === 'sprung';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 36 36" width="${px}" height="${px}" style="overflow:visible">`
    + `<ellipse cx="16" cy="29" rx="10.5" ry="2.2" fill="#000" opacity="0.28"/>`
    + fn(false, sprung)
    + `</svg>`;
}

export function drawVectorTrap(ctx, x, y, size, kind, state) {
  const key = trapKey(kind, state);
  return rasterDraw(ctx, x, y, size, key, () => trapSVG(kind, state, 256), TRAP_OVERSCAN);
}

export function preloadTrapArt() {
  for (const kind of Object.keys(TRAPS)) {
    rasterPreload(trapKey(kind, 'armed'), () => trapSVG(kind, 'armed', 256));
    rasterPreload(trapKey(kind, 'sprung'), () => trapSVG(kind, 'sprung', 256));
  }
}

export { TRAPS, TRAP_META };

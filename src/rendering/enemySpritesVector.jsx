// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Enemy Sprite Engine v2 (detailed, per-enemy art)
//  ────────────────────────────────────────────────────────────────────
//  Every foe in enemies.json gets a richly-detailed, individually-tuned
//  vector pixel-sprite. Built from:
//    • 10 high-detail ARCHETYPE bodies (multi-tone shading + ink outlines)
//    • per-enemy PALETTE
//    • per-enemy FEATURE flags (eyes, horns, weapon, wings, chains, …)
//    • per-enemy SIGNATURE overlay (SIG[id]) — unique marks, gear, glows
//
//  The SIGNATURE layer is what makes each enemy distinct rather than a
//  recolored archetype: bell-haunt gets a tolling bell, ink-scribe a
//  floating quill + page swarm, the-below a collapsing event-horizon, etc.
//
//  This is the in-engine port of the `enemy-sprites.jsx` handoff. The design
//  code (primitives, ARCH, PAL, SIG, ENEMY_SPECS) is verbatim — only the
//  React runtime is swapped for a tiny `h()` hyperscript that emits SVG
//  markup strings, so the rendered SVG is identical. The strings are then
//  rasterised once per enemy and drawn onto the game canvas.
//
//  id matches enemies.json keys 1:1.
// ═══════════════════════════════════════════════════════════════════════

// ── tiny hyperscript: JSX → SVG markup string (no React) ───────────────
// esbuild is configured (vite/vitest) with jsxFactory:'h', jsxFragment:'Fragment'.
const Fragment = Symbol('Fragment');
const React = { Fragment };

// camelCase prop → SVG attribute name. Anything not listed passes through
// unchanged (cx, cy, r, d, points, transform, filter, opacity, stdDeviation,
// result, in, x1, y1, …) which is exactly what SVG wants.
const ATTR_MAP = {
  strokeWidth: 'stroke-width', strokeLinejoin: 'stroke-linejoin',
  strokeLinecap: 'stroke-linecap', strokeDasharray: 'stroke-dasharray',
  fontSize: 'font-size', fillOpacity: 'fill-opacity', strokeOpacity: 'stroke-opacity',
  fillRule: 'fill-rule', clipRule: 'clip-rule', clipPath: 'clip-path',
  stopColor: 'stop-color', stopOpacity: 'stop-opacity', className: 'class',
};

const _kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

function _styleToString(obj) {
  let out = '';
  for (const k in obj) {
    const v = obj[k];
    if (v == null || v === false) continue;
    out += `${_kebab(k)}:${v};`;
  }
  return out;
}

function _attrs(props) {
  if (!props) return '';
  let out = '';
  for (const k in props) {
    if (k === 'key' || k === 'children') continue;
    let v = props[k];
    if (v == null || v === false) continue;
    if (k === 'style') {
      v = (typeof v === 'object') ? _styleToString(v) : v;
      if (!v) continue;
    }
    const name = ATTR_MAP[k] || k;
    out += ` ${name}="${String(v).replace(/"/g, '&quot;')}"`;
  }
  return out;
}

function h(tag, props, ...children) {
  const inner = children
    .flat(Infinity)
    .filter((c) => c != null && c !== false && c !== true)
    .join('');
  if (tag === Fragment) return inner;
  return `<${tag}${_attrs(props)}>${inner}</${tag}>`;
}

const _ink = '#08070c';

// ── primitives ────────────────────────────────────────────────────────
const Eye = (cx, cy, r, col, k) =>
  <circle key={k} cx={cx} cy={cy} r={r} fill={col}
    style={{ filter:`drop-shadow(0 0 ${r*1.6}px ${col})` }}/>;

const Pupil = (cx, cy, r, col, k) => (
  <g key={k}>
    <circle cx={cx} cy={cy} r={r} fill={col} style={{filter:`drop-shadow(0 0 ${r*1.6}px ${col})`}}/>
    <circle cx={cx} cy={cy} r={r*0.45} fill="#fff" opacity="0.85"/>
  </g>
);

const Glow = (id, color, dev=1.4) =>
  <filter id={id} x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation={dev} result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>;

// outline wrapper: re-strokes a path-ish silhouette in ink for crisp edges
const outline = (col=_ink, w=0.7) => ({ stroke: col, strokeWidth: w, strokeLinejoin:'round' });

// ═══════════════════════════════════════════════════════════════════════
// ARCHETYPE RENDERERS (0 0 32 32) — now with shading tiers + ink outlines
// p = { dark, mid, light, accent, eye, metal? }
// ═══════════════════════════════════════════════════════════════════════
const ARCH = {

  humanoid: (p, o={}) => (<>
    {o.cloak && <path d="M9 13 Q3 22 6 31 L12 31 L11 14 Z" fill={p.accent} opacity="0.9" {...outline()}/>}
    {/* legs */}
    <rect x="11" y="23" width="3.4" height="7" fill={p.dark} {...outline()}/>
    <rect x="17.6" y="23" width="3.4" height="7" fill={p.dark} {...outline()}/>
    <rect x="10.6" y="28.5" width="4.4" height="2" fill={p.mid} {...outline()}/>
    <rect x="17" y="28.5" width="4.4" height="2" fill={p.mid} {...outline()}/>
    {/* torso */}
    <path d="M9.5 13 L22.5 13 L21 24 L11 24 Z" fill={p.mid} {...outline()}/>
    <path d="M9.5 13 L16 13 L15 24 L11 24 Z" fill={p.dark} opacity="0.45"/>
    <path d="M19 13.5 L20.5 23" stroke={p.light} strokeWidth="0.5" opacity="0.3"/>
    <rect x="10.5" y="19.5" width="11" height="2.2" fill={p.accent} opacity="0.85" {...outline(_ink,0.5)}/>
    <circle cx="16" cy="20.6" r="0.9" fill={p.light}/>
    {/* arms */}
    <rect x="6.6" y="14" width="3.2" height="8.5" fill={p.mid} {...outline()}/>
    <rect x="22.2" y="14" width="3.2" height="8.5" fill={p.mid} {...outline()}/>
    {o.pauldrons && <>
      <ellipse cx="8.6" cy="14.5" rx="3.4" ry="2.7" fill={p.metal||p.light} {...outline()}/>
      <ellipse cx="23.4" cy="14.5" rx="3.4" ry="2.7" fill={p.metal||p.light} {...outline()}/>
      <ellipse cx="8.6" cy="13.8" rx="2" ry="1.2" fill="#fff" opacity="0.22"/>
    </>}
    {/* head */}
    {o.skull ? (<>
      <ellipse cx="16" cy="8.6" rx="5.2" ry="5.6" fill={p.light} {...outline()}/>
      <ellipse cx="14" cy="7.4" rx="1.6" ry="1.2" fill="#fff" opacity="0.25"/>
      <rect x="12.8" y="12.6" width="6.4" height="3.4" fill={p.light} {...outline(_ink,0.5)}/>
      {[13.3,15.3,17.3].map((x,i)=><rect key={i} x={x} y="12.8" width="1.3" height="3" fill={_ink}/>)}
      <ellipse cx="13.7" cy="8.2" rx="1.8" ry="2" fill={_ink}/>
      <ellipse cx="18.3" cy="8.2" rx="1.8" ry="2" fill={_ink}/>
      {Pupil(13.7,8.4,0.85,p.eye,'a')}{Pupil(18.3,8.4,0.85,p.eye,'b')}
      <path d="M15.4 10.4 L16 12 L16.6 10.4 Z" fill={_ink}/>
    </>) : (<>
      {o.helm
        ? <><path d="M10.6 5 Q16 1.6 21.4 5 L21.4 12 L10.6 12 Z" fill={p.metal||p.light} {...outline()}/>
            <rect x="10.6" y="7.6" width="10.8" height="2.4" fill={_ink}/>
            <rect x="15.4" y="5" width="1.2" height="7" fill={_ink} opacity="0.6"/>
            <path d="M11 5.4 Q16 2.4 21 5.4" stroke="#fff" strokeWidth="0.5" opacity="0.3" fill="none"/></>
        : <><ellipse cx="16" cy="8.8" rx="5.4" ry="5.8" fill={p.light} {...outline()}/>
            <ellipse cx="13.8" cy="7" rx="1.6" ry="1.2" fill="#fff" opacity="0.2"/></>}
      {Pupil(13.7, o.helm?8.9:9, 1.05, p.eye,'a')}
      {Pupil(18.3, o.helm?8.9:9, 1.05, p.eye,'b')}
      {!o.helm && <path d="M13.6 11.6 Q16 13 18.4 11.6" stroke={p.dark} strokeWidth="0.6" fill="none"/>}
    </>)}
    {o.ears && <>
      <path d="M10.8 8 L6.4 4.6 L10 10 Z" fill={p.light} {...outline()}/>
      <path d="M21.2 8 L25.6 4.6 L22 10 Z" fill={p.light} {...outline()}/>
    </>}
    {o.horns && <>
      <path d="M11.8 5 Q9 -0.5 12.6 3.6 Z" fill={p.accent} {...outline()}/>
      <path d="M20.2 5 Q23 -0.5 19.4 3.6 Z" fill={p.accent} {...outline()}/>
    </>}
    {o.weapon==='sword' && <>
      <rect x="24" y="6.5" width="1.8" height="16" fill={p.metal||'#aab0c0'} {...outline(_ink,0.5)}/>
      <rect x="24.4" y="7" width="0.6" height="14" fill="#fff" opacity="0.4"/>
      <rect x="22.3" y="20" width="5.2" height="1.8" fill={p.accent} {...outline(_ink,0.5)}/>
      <circle cx="24.9" cy="23.4" r="1" fill={p.accent}/>
    </>}
    {o.weapon==='bow' && <>
      <path d="M25.4 5.5 Q31.5 14 25.4 22.5" fill="none" stroke={p.accent} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="25.4" y1="5.5" x2="25.4" y2="22.5" stroke={p.light} strokeWidth="0.5"/>
      <line x1="14" y1="14" x2="25.4" y2="14" stroke="#e0d4a8" strokeWidth="0.7"/>
      <path d="M14 14 L16 13 L16 15 Z" fill="#e0d4a8"/>
    </>}
    {o.weapon==='scythe' && <>
      <rect x="24.2" y="3" width="1.6" height="22" fill="#3a2818" {...outline(_ink,0.5)}/>
      <path d="M25 3 Q32 4 30.5 11" fill="none" stroke={p.metal||'#cfcfe0'} strokeWidth="2" strokeLinecap="round"/>
      <path d="M25 3 Q31 4.4 30 9.5" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.4"/>
    </>}
  </>),

  beast: (p, o={}) => (<>
    <path d="M6 19 Q0.5 16 2.5 11" fill="none" stroke={p.mid} strokeWidth="2.6" strokeLinecap="round"/>
    <rect x="7" y="21.5" width="2.8" height="7.5" fill={p.dark} {...outline()}/>
    <rect x="11" y="22.5" width="2.8" height="6.5" fill={p.dark} {...outline()}/>
    <rect x="18.5" y="22.5" width="2.8" height="6.5" fill={p.dark} {...outline()}/>
    <rect x="22.6" y="21.5" width="2.8" height="7.5" fill={p.dark} {...outline()}/>
    <ellipse cx="16" cy="18.5" rx="10.5" ry="6" fill={p.mid} {...outline()}/>
    <ellipse cx="16" cy="20.5" rx="9" ry="3.6" fill={p.dark} opacity="0.5"/>
    <ellipse cx="11" cy="15.5" rx="4" ry="2" fill={p.light} opacity="0.25"/>
    {o.spines && [9,13,17,21].map((x,i)=>(
      <path key={i} d={`M${x} 13.5 L${x+2} 8 L${x+4} 13.5 Z`} fill={p.accent} {...outline()}/>
    ))}
    <ellipse cx="25.5" cy="15.5" rx="5.6" ry="4.6" fill={p.mid} {...outline()}/>
    <path d="M28.5 13.5 L31.5 12.5 L29.5 17 Z" fill={p.light} {...outline()}/>
    <path d="M21.5 17.5 L30.5 17.5 L29.5 20 L22.5 20 Z" fill={p.dark} {...outline(_ink,0.5)}/>
    {o.fangs && <>
      <path d="M23.5 17.6 L24.2 21 L24.9 17.6 Z" fill="#e8dcb8"/>
      <path d="M27 17.6 L27.7 21 L28.4 17.6 Z" fill="#e8dcb8"/>
    </>}
    <path d="M22 11.5 L20.6 6 L25 10.5 Z" fill={p.mid} {...outline()}/>
    {Pupil(25.5, 15, 1.2, p.eye,'a')}
    {o.collar && <ellipse cx="20" cy="18" rx="3.2" ry="3.8" fill="none" stroke={p.accent} strokeWidth="1.3"/>}
  </>),

  flyer: (p, o={}) => (<>
    <path d="M16 13.5 Q3 4 0.5 15.5 Q6 13 9 17.5 Q3.5 16.5 5 22 L16 17.5 Z" fill={p.mid} {...outline()}/>
    <path d="M16 13.5 Q29 4 31.5 15.5 Q26 13 23 17.5 Q28.5 16.5 27 22 L16 17.5 Z" fill={p.mid} {...outline()}/>
    <path d="M16 13.5 Q6 8.5 2.5 15" stroke={p.accent} strokeWidth="0.5" opacity="0.7" fill="none"/>
    <path d="M16 13.5 Q26 8.5 29.5 15" stroke={p.accent} strokeWidth="0.5" opacity="0.7" fill="none"/>
    <path d="M16 14.5 Q9 13 6 19" stroke={p.dark} strokeWidth="0.4" opacity="0.5" fill="none"/>
    <ellipse cx="16" cy="16" rx="3.8" ry="5.4" fill={p.dark} {...outline()}/>
    <ellipse cx="16" cy="13.5" rx="3" ry="3" fill={p.mid} {...outline()}/>
    <ellipse cx="14.8" cy="12.4" rx="1" ry="0.8" fill="#fff" opacity="0.25"/>
    {o.antennae ? <>
      <path d="M14 11 Q11.5 5.5 12.5 4.5" fill="none" stroke={p.accent} strokeWidth="0.8"/>
      <path d="M18 11 Q20.5 5.5 19.5 4.5" fill="none" stroke={p.accent} strokeWidth="0.8"/>
      <circle cx="12.5" cy="4.5" r="1.1" fill={p.accent} style={{filter:`drop-shadow(0 0 3px ${p.accent})`}}/>
      <circle cx="19.5" cy="4.5" r="1.1" fill={p.accent} style={{filter:`drop-shadow(0 0 3px ${p.accent})`}}/>
    </> : <>
      <path d="M14 11 L12.6 6.5 L16 11 Z" fill={p.dark} {...outline()}/>
      <path d="M18 11 L19.4 6.5 L16 11 Z" fill={p.dark} {...outline()}/>
    </>}
    {Pupil(14.5, 13.6, 1, p.eye,'a')}{Pupil(17.5, 13.6, 1, p.eye,'b')}
    {o.fangs && <><path d="M15 17 L15.6 19 L16.2 17 Z" fill="#e8dcb8"/><path d="M16.4 17 L17 18.6 L17.6 17 Z" fill="#e8dcb8"/></>}
    {o.tail && <path d="M16 21 Q16.5 26 19 28.5" fill="none" stroke={p.mid} strokeWidth="1.7" strokeLinecap="round"/>}
  </>),

  golem: (p, o={}) => (<>
    <rect x="9.5" y="23.5" width="5" height="6.5" fill={p.dark} {...outline()}/>
    <rect x="17.5" y="23.5" width="5" height="6.5" fill={p.dark} {...outline()}/>
    <path d="M6.5 11.5 L25.5 11.5 L24 25 L8 25 Z" fill={p.mid} {...outline()}/>
    <path d="M6.5 11.5 L16 11.5 L16 25 L8 25 Z" fill={p.light} opacity="0.16"/>
    <path d="M11.5 13.5 L13.5 19 L10.5 23.5" stroke={p.dark} strokeWidth="0.8" fill="none" opacity="0.7"/>
    <path d="M20.5 14.5 L18.5 20 L21.5 24.5" stroke={p.dark} strokeWidth="0.8" fill="none" opacity="0.7"/>
    <path d="M8 12.5 L24 12.5" stroke={p.light} strokeWidth="0.5" opacity="0.3"/>
    {o.coreGlow && <>
      <circle cx="16" cy="18" r="3" fill={p.accent} style={{filter:`drop-shadow(0 0 7px ${p.accent})`}}/>
      <circle cx="16" cy="18" r="1.4" fill="#fff" opacity="0.8"/>
    </>}
    <rect x="2.8" y="12.5" width="4.8" height="10.5" fill={p.mid} {...outline()}/>
    <rect x="24.4" y="12.5" width="4.8" height="10.5" fill={p.mid} {...outline()}/>
    <rect x="2.2" y="20.5" width="6" height="5.5" fill={p.light} opacity="0.5" {...outline(_ink,0.5)}/>
    <rect x="23.8" y="20.5" width="6" height="5.5" fill={p.light} opacity="0.5" {...outline(_ink,0.5)}/>
    <rect x="11.5" y="4.5" width="9" height="7.5" fill={p.mid} {...outline()}/>
    <rect x="11.5" y="4.5" width="9" height="1.6" fill={p.light} opacity="0.4"/>
    {Pupil(13.8, 8.2, 1.1, p.eye,'a')}{Pupil(18.2, 8.2, 1.1, p.eye,'b')}
    {o.crown && [12.5,15.5,18.5].map((x,i)=>(
      <path key={i} d={`M${x} 4.5 L${x+1.5} 0.5 L${x+3} 4.5 Z`} fill={p.accent} {...outline()}/>
    ))}
    {o.runes && <><rect x="12.5" y="14" width="7" height="0.9" fill={p.accent} opacity="0.85"/>
      <rect x="14" y="16" width="4" height="0.7" fill={p.accent} opacity="0.6"/></>}
  </>),

  wraith: (p, o={}, gid='w') => (<>
    <defs>{Glow(gid+'-g', p.accent, 1.7)}</defs>
    <path d="M8.5 13.5 Q6.5 27 9.5 31.5 L11.5 26 L13.5 31.5 L15.5 25 L17.5 31.5 L19.5 26 L21.5 31.5 Q25 27 22.5 13.5 Z"
      fill={p.mid} opacity="0.94" {...outline()}/>
    <path d="M10.5 16 Q9.5 26 11.5 30.5" stroke={p.dark} strokeWidth="0.6" fill="none" opacity="0.6"/>
    <path d="M16 16 L16 30" stroke={p.dark} strokeWidth="0.5" fill="none" opacity="0.4"/>
    <path d="M8.5 13.5 Q16 3.5 23.5 13.5 L23.5 18 L8.5 18 Z" fill={p.dark} {...outline()}/>
    <path d="M10.5 12.5 Q16 5.5 21.5 12.5 L21.5 16 L10.5 16 Z" fill={p.mid}/>
    <ellipse cx="16" cy="11.8" rx="4.2" ry="4.8" fill={_ink}/>
    {Pupil(14.1, 11.8, 1.25, p.eye,'a')}{Pupil(17.9, 11.8, 1.25, p.eye,'b')}
    {o.reach && <>
      <path d="M9 16 Q2.5 18 1.5 24.5" stroke={p.mid} strokeWidth="1.7" fill="none" opacity="0.85" strokeLinecap="round"/>
      <path d="M23 16 Q29.5 18 30.5 24.5" stroke={p.mid} strokeWidth="1.7" fill="none" opacity="0.85" strokeLinecap="round"/>
      <path d="M1.5 24.5 l-1 -2 M1.5 24.5 l1.6 -1.4 M1.5 24.5 l-0.4 2" stroke={p.mid} strokeWidth="1" fill="none"/>
      <path d="M30.5 24.5 l1 -2 M30.5 24.5 l-1.6 -1.4 M30.5 24.5 l0.4 2" stroke={p.mid} strokeWidth="1" fill="none"/>
    </>}
    {o.chains && [4,28].map((x,i)=>(
      <g key={i} opacity="0.6">{[0,1,2,3].map(j=>(
        <ellipse key={j} cx={x} cy={6+j*7} rx="1.5" ry="3.2" fill="none" stroke={p.light} strokeWidth="0.8"/>
      ))}</g>
    ))}
    {o.crown && [12,16,20].map((x,i)=>(
      <path key={i} d={`M${x} 6.5 L${x+1.5} 1.5 L${x+3} 6.5 Z`} fill={p.accent}
        style={{filter:`drop-shadow(0 0 4px ${p.accent})`}}/>
    ))}
    <ellipse cx="16" cy="16" rx="13" ry="14" fill={p.accent} opacity="0.06" filter={`url(#${gid}-g)`}/>
  </>),

  serpent: (p, o={}) => (<>
    <path d="M3.5 27 Q10 27 12 22.5 Q14 18 20 18 Q27.5 18 27.5 11.5 Q27.5 6 22 6"
      fill="none" stroke={p.mid} strokeWidth="6.4" strokeLinecap="round" {...outline()}/>
    <path d="M3.5 27 Q10 27 12 22.5 Q14 18 20 18 Q27.5 18 27.5 11.5 Q27.5 6 22 6"
      fill="none" stroke={p.dark} strokeWidth="2.6" strokeLinecap="round" opacity="0.5"/>
    <path d="M3.5 25.5 Q10 25.5 12 21" fill="none" stroke={p.light} strokeWidth="0.8" opacity="0.3"/>
    {o.segments && [[10.5,24],[14.5,19.5],[20,18],[25.5,13]].map(([x,y],i)=>(
      <ellipse key={i} cx={x} cy={y} rx="3.6" ry="3.2" fill="none" stroke={p.accent} strokeWidth="0.8" opacity="0.7"/>
    ))}
    <ellipse cx="21" cy="6.5" rx="4.6" ry="3.8" fill={p.light} {...outline()}/>
    <ellipse cx="19.4" cy="5.4" rx="1.2" ry="0.9" fill="#fff" opacity="0.3"/>
    {o.fangs && <><path d="M18 8.5 L18.6 11.5 L19.2 8.5 Z" fill="#e8dcb8"/><path d="M23 8.5 L23.6 11.5 L24.2 8.5 Z" fill="#e8dcb8"/></>}
    {Pupil(19.4, 6, 1, p.eye,'a')}{Pupil(22.6, 6, 1, p.eye,'b')}
    {o.frill && <>
      <path d="M17 4 L13.5 0.5 L18 4 Z" fill={p.accent} {...outline()}/>
      <path d="M25 4 L28.5 0.5 L24 4 Z" fill={p.accent} {...outline()}/>
    </>}
  </>),

  caster: (p, o={}, gid='c') => (<>
    <defs>{Glow(gid+'-g', p.accent, 1.5)}</defs>
    <path d="M8.5 13 L23.5 13 L26.5 30 L5.5 30 Z" fill={p.mid} {...outline()}/>
    <path d="M8.5 13 L16 13 L16 30 L5.5 30 Z" fill={p.dark} opacity="0.42"/>
    <path d="M5.5 30 L26.5 30" stroke={p.accent} strokeWidth="1.1" opacity="0.85"/>
    <path d="M16 13 L16 30" stroke={p.accent} strokeWidth="0.5" opacity="0.4"/>
    <path d="M10 15 L9 29 M22 15 L23 29" stroke={p.dark} strokeWidth="0.5" opacity="0.4"/>
    <path d="M10 13 Q16 1.5 22 13 Z" fill={p.dark} {...outline()}/>
    <path d="M12 12 Q16 4.5 20 12 Z" fill={_ink}/>
    {Pupil(14.4, 10, 1, p.eye,'a')}{Pupil(17.6, 10, 1, p.eye,'b')}
    <path d="M8.5 14 L4.5 22 L7.5 23.2 L11 16 Z" fill={p.mid} {...outline()}/>
    <path d="M23.5 14 L27.5 22 L24.5 23.2 L21 16 Z" fill={p.mid} {...outline()}/>
    {o.tome && <>
      <rect x="2.5" y="19.5" width="6.4" height="5.4" fill="#3a2818" {...outline(_ink,0.5)}/>
      <rect x="3.1" y="20.1" width="5.2" height="4.2" fill={p.accent} opacity="0.85"/>
      <rect x="5.4" y="19.5" width="0.6" height="5.4" fill="#1a0e04"/>
    </>}
    {o.staff && <>
      <rect x="25.2" y="5" width="1.5" height="23" fill="#3a2818" {...outline(_ink,0.5)}/>
      <circle cx="25.9" cy="5" r="2.8" fill={p.accent} filter={`url(#${gid}-g)`}/>
      <circle cx="25.9" cy="5" r="1.1" fill="#fff" opacity="0.85"/>
    </>}
    {o.halo && <ellipse cx="16" cy="7.5" rx="6.4" ry="2.1" fill="none" stroke={p.accent} strokeWidth="0.9" opacity="0.75"
      style={{filter:`drop-shadow(0 0 4px ${p.accent})`}}/>}
  </>),

  seraph: (p, o={}, gid='s') => (<>
    <defs>{Glow(gid+'-g', p.accent, 1.9)}</defs>
    <path d="M16 11.5 Q2.5 3.5 0.5 13.5 Q7 11.5 10 15.5 Z" fill={p.mid} opacity="0.9" {...outline()}/>
    <path d="M16 11.5 Q29.5 3.5 31.5 13.5 Q25 11.5 22 15.5 Z" fill={p.mid} opacity="0.9" {...outline()}/>
    <path d="M16 14 Q4.5 12 1.5 20.5 Q8 18 11 21.5 Z" fill={p.dark} opacity="0.88" {...outline()}/>
    <path d="M16 14 Q27.5 12 30.5 20.5 Q24 18 21 21.5 Z" fill={p.dark} opacity="0.88" {...outline()}/>
    <path d="M16 11.5 Q8 7 3.5 12.5 M16 11.5 Q24 7 28.5 12.5" stroke={p.accent} strokeWidth="0.4" fill="none" opacity="0.6"/>
    <path d="M13 11.5 L19 11.5 L17 30 L15 30 Z" fill={p.light} {...outline()}/>
    <path d="M13 11.5 L16 11.5 L15.5 30 L15 30 Z" fill={p.dark} opacity="0.3"/>
    {o.ribs && [15.5,18.5,21.5,24.5].map((y,i)=>(
      <path key={i} d={`M13.5 ${y} Q16 ${y+1.6} 18.5 ${y}`} stroke={p.dark} strokeWidth="0.5" fill="none" opacity="0.6"/>
    ))}
    <ellipse cx="16" cy="8.5" rx="3.1" ry="3.7" fill={p.light} {...outline()}/>
    {o.blindfold
      ? <rect x="12.8" y="7.6" width="6.4" height="2.1" fill={p.accent} opacity="0.85" {...outline(_ink,0.4)}/>
      : <>{Pupil(14.6,8.5,0.9,p.eye,'a')}{Pupil(17.4,8.5,0.9,p.eye,'b')}</>}
    {o.halo && <circle cx="16" cy="5.5" r="4.8" fill="none" stroke={p.accent} strokeWidth="0.9"
      style={{filter:`drop-shadow(0 0 5px ${p.accent})`}}/>}
    {o.manyEyes && [[7,8],[25,8],[6,18],[26,18],[9,24],[23,24]].map(([x,y],i)=>(
      <React.Fragment key={i}>{Pupil(x,y,0.75,p.eye,'e'+i)}</React.Fragment>
    ))}
    <ellipse cx="16" cy="16" rx="15" ry="15" fill={p.accent} opacity="0.05" filter={`url(#${gid}-g)`}/>
  </>),

  slime: (p, o={}) => (<>
    <path d="M4.5 28 Q2.5 15.5 10 12.5 Q16 9.5 22 12.5 Q29.5 15.5 27.5 28 Z" fill={p.mid} {...outline()}/>
    <path d="M4.5 28 Q2.5 15.5 10 12.5 Q13 11.5 14 13.5 Q9 16.5 9 28 Z" fill={p.light} opacity="0.22"/>
    <path d="M10 13 Q16 10.5 22 13" stroke="#fff" strokeWidth="0.6" opacity="0.25" fill="none"/>
    <ellipse cx="9" cy="29" rx="1.7" ry="2.6" fill={p.mid} {...outline(_ink,0.4)}/>
    <ellipse cx="16" cy="30" rx="1.9" ry="2.8" fill={p.mid} {...outline(_ink,0.4)}/>
    <ellipse cx="23" cy="29" rx="1.7" ry="2.6" fill={p.mid} {...outline(_ink,0.4)}/>
    {o.fungus && <>
      <rect x="10.6" y="5.5" width="1.3" height="6.5" fill="#d8cba0" {...outline(_ink,0.3)}/>
      <ellipse cx="11.3" cy="5.5" rx="2.6" ry="1.8" fill={p.accent} style={{filter:`drop-shadow(0 0 4px ${p.accent})`}}/>
      <circle cx="10.6" cy="5.2" r="0.4" fill="#fff" opacity="0.6"/>
      <rect x="19" y="7.5" width="1.1" height="5.5" fill="#d8cba0" {...outline(_ink,0.3)}/>
      <ellipse cx="19.5" cy="7.5" rx="2" ry="1.3" fill={p.accent}/>
    </>}
    {o.tendrils && [8,16,24].map((x,i)=>(
      <path key={i} d={`M${x} 13 Q${x+2} 5.5 ${x} 1.5`} stroke={p.accent} strokeWidth="1.1" fill="none" opacity="0.75"/>
    ))}
    {Pupil(13, 19, 1.4, p.eye,'a')}{Pupil(19, 19, 1.4, p.eye,'b')}
    <circle cx="10.5" cy="22.5" r="1.1" fill={p.light} opacity="0.3"/>
    <circle cx="22" cy="24.5" r="1.3" fill={p.light} opacity="0.3"/>
    <circle cx="16" cy="25" r="0.8" fill={p.light} opacity="0.25"/>
  </>),

  imp: (p, o={}, gid='i') => (<>
    <defs>{Glow(gid+'-g', p.accent, 1.5)}</defs>
    <path d="M11 15 Q3.5 11.5 2.5 18.5 Q7 16 10 19.5 Z" fill={p.dark} {...outline()}/>
    <path d="M21 15 Q28.5 11.5 29.5 18.5 Q25 16 22 19.5 Z" fill={p.dark} {...outline()}/>
    <ellipse cx="16" cy="19" rx="6.2" ry="6.6" fill={p.mid} {...outline()}/>
    <ellipse cx="13.8" cy="16.8" rx="2.4" ry="2.8" fill={p.light} opacity="0.3"/>
    <rect x="12.8" y="24" width="2.2" height="5.2" fill={p.dark} {...outline()}/>
    <rect x="17" y="24" width="2.2" height="5.2" fill={p.dark} {...outline()}/>
    <ellipse cx="16" cy="9.8" rx="4.6" ry="4.2" fill={p.mid} {...outline()}/>
    <path d="M11.8 7.8 Q9.5 2.5 13.4 6.8 Z" fill={p.accent} {...outline()}/>
    <path d="M20.2 7.8 Q22.5 2.5 18.6 6.8 Z" fill={p.accent} {...outline()}/>
    <path d="M13 11.4 Q16 14.2 19 11.4" stroke={_ink} strokeWidth="0.9" fill="none"/>
    {[14,15.3,16.6,17.9].map((x,i)=><path key={i} d={`M${x} 12 L${x+0.4} 13 L${x+0.8} 12 Z`} fill="#fff" opacity="0.6"/>)}
    {Pupil(14.2, 9.3, 1.1, p.eye,'a')}{Pupil(17.8, 9.3, 1.1, p.eye,'b')}
    <path d="M22 21 Q27.5 22 26.5 16 L28.5 18" stroke={p.mid} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    {o.flame && <path d="M13.5 6 Q16 -1 18.5 6 Q17 3.5 16 5 Q15 3.5 13.5 6 Z" fill={p.accent} filter={`url(#${gid}-g)`}/>}
  </>),
};

const ARCH_ANIM = {
  humanoid:'sd-en-bob', beast:'sd-en-bob', flyer:'sd-en-float', golem:'sd-en-heavy',
  wraith:'sd-en-float', serpent:'sd-en-sway', caster:'sd-en-float', seraph:'sd-en-float',
  slime:'sd-en-squish', imp:'sd-en-float',
};

// ═══════════════════════════════════════════════════════════════════════
// PALETTES
// ═══════════════════════════════════════════════════════════════════════
const PAL = {
  goblin:{dark:'#2e3a1c',mid:'#5d7a36',light:'#a4c270',accent:'#7a5e34',eye:'#ffaa33'},
  bone:{dark:'#5a5240',mid:'#9a8e6c',light:'#e0d4a8',accent:'#7a5e34',eye:'#9ec8ff',metal:'#7a6e54'},
  shadow:{dark:'#0a0810',mid:'#241830',light:'#3a2848',accent:'#9a5fb8',eye:'#c08aff'},
  stone:{dark:'#2a2630',mid:'#4a4654',light:'#6a6678',accent:'#4a7eb8',eye:'#7faafa',metal:'#5a5666'},
  ember:{dark:'#3a0c08',mid:'#7a1c10',light:'#c4503a',accent:'#ff8844',eye:'#ffd060'},
  ice:{dark:'#1a3048',mid:'#3a5878',light:'#9ec8f0',accent:'#bfd6ff',eye:'#dff0ff'},
  blood:{dark:'#3a0808',mid:'#7a1414',light:'#c4503a',accent:'#ff5530',eye:'#ff8844'},
  iron:{dark:'#1a1620',mid:'#3a3444',light:'#5a5468',accent:'#d4ac6c',eye:'#ff8844',metal:'#6a6478'},
  void:{dark:'#04020a',mid:'#1a0824',light:'#3a1a4a',accent:'#9a40e8',eye:'#c08aff'},
  ink:{dark:'#0a0a12',mid:'#1f1f2e',light:'#3a3a52',accent:'#4a7eb8',eye:'#7faafa'},
  moss:{dark:'#1a2410',mid:'#3a5020',light:'#6b9156',accent:'#88c656',eye:'#c4ff7f'},
  brine:{dark:'#0a2028',mid:'#1f4048',light:'#3a6058',accent:'#6acaba',eye:'#a8e0d4'},
  candle:{dark:'#2a1c08',mid:'#5a3c14',light:'#9a7838',accent:'#ffaa33',eye:'#ffe488'},
  rust:{dark:'#2a1810',mid:'#5a3420',light:'#8a5838',accent:'#c4844a',eye:'#ffaa66'},
  glass:{dark:'#16202a',mid:'#2a3a4a',light:'#5a7a9a',accent:'#a8d0e8',eye:'#e0f4ff'},
  hive:{dark:'#2a2008',mid:'#5a4810',light:'#9a8030',accent:'#d4b040',eye:'#ffe060'},
  marrow:{dark:'#3a2820',mid:'#6a4838',light:'#a08068',accent:'#d8cba0',eye:'#ff8844'},
  wyrm:{dark:'#1a2818',mid:'#3a5828',light:'#6a8a48',accent:'#c4503a',eye:'#ffaa33'},
  pale:{dark:'#2a2a30',mid:'#4a4a54',light:'#8a8a98',accent:'#c08aff',eye:'#dff0ff'},
  regent:{dark:'#1a1224',mid:'#3a2848',light:'#5a4070',accent:'#d4ac6c',eye:'#ff8844',metal:'#7a5e9a'},
  titan:{dark:'#2a1408',mid:'#5a2c12',light:'#8a4824',accent:'#ff5530',eye:'#ffd060',metal:'#6a4430'},
  oracle:{dark:'#2a1c08',mid:'#5a4014',light:'#9a7028',accent:'#ffe488',eye:'#fff2c0'},
  below:{dark:'#02000a',mid:'#160826',light:'#2e1248',accent:'#9a40e8',eye:'#ff5530'},
};

// ═══════════════════════════════════════════════════════════════════════
// SIGNATURE OVERLAYS — bespoke per-enemy detail (drawn ON TOP of archetype)
// keyed by enemy id; each receives the palette p. This is the individuality.
// ═══════════════════════════════════════════════════════════════════════
const SIG = {
  goblin_scout: p => <><rect x="6" y="20" width="4" height="3" fill="#3a2818" {...outline(_ink,0.4)}/><circle cx="8" cy="21.5" r="0.8" fill={p.accent}/></>, // belt pouch
  skeleton_archer: p => <g opacity="0.85">{[0,1,2].map(i=><line key={i} x1={26+i*0.4} y1={4+i} x2={28} y2={2+i} stroke="#e0d4a8" strokeWidth="0.5"/>)}</g>, // quiver arrows
  cave_bat: p => <ellipse cx="16" cy="22" rx="2" ry="0.8" fill={p.dark} opacity="0.5"/>,
  shroud_crawler: p => <g opacity="0.7">{[7,12,20,25].map((x,i)=><path key={i} d={`M${x} 28 Q${x+1} 31 ${x-1} 32`} stroke={p.accent} strokeWidth="0.6" fill="none"/>)}</g>, // crawling shroud wisps
  candle_licker: p => <><rect x="15.2" y="2" width="1.6" height="4" fill="#e8dcb8"/><ellipse cx="16" cy="1.8" rx="1.2" ry="2" fill="#ffe488" style={{filter:'drop-shadow(0 0 5px #ffaa33)'}}/></>, // candle on head
  stone_golem: p => <g opacity="0.6">{[[10,14],[21,16],[14,22]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="0.8" fill={p.light}/>)}</g>, // moss specks
  grave_moss: p => <g opacity="0.7">{[6,11,21,26].map((x,i)=><path key={i} d={`M${x} 26 q1 -3 0 -5`} stroke={p.accent} strokeWidth="0.6" fill="none"/>)}</g>, // grass tufts
  bell_haunt: p => <><path d="M13 19 Q13 14 16 14 Q19 14 19 19 Z" fill={p.metal||'#9a8e6c'} {...outline(_ink,0.5)}/><rect x="12.5" y="19" width="7" height="1.4" fill={p.dark}/><circle cx="16" cy="21.5" r="1" fill={p.accent}/></>, // tolling bell body
  marrow_hound: p => <g opacity="0.8">{[12,16,20].map((x,i)=><path key={i} d={`M${x} 14 l1.5 -3 l1.5 3`} stroke="#e0d4a8" strokeWidth="0.6" fill="none"/>)}</g>, // exposed rib spines
  ossuary_moth: p => <g opacity="0.6">{[[8,15],[24,15],[10,19],[22,19]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.4" fill="none" stroke={p.dark} strokeWidth="0.5"/>)}</g>, // wing eyespots
  shadow_wraith: p => <g opacity="0.5">{[5,27].map((x,i)=><path key={i} d={`M${x} 10 Q${x} 20 ${x+(i?-2:2)} 28`} stroke={p.accent} strokeWidth="0.6" fill="none"/>)}</g>, // trailing shadow
  deep_lurker: p => <g opacity="0.85">{[[5,12],[8,9],[24,9],[27,12]].map(([x,y],i)=>Eye(x,y,0.7,p.eye,i))}</g>, // extra lure eyes
  rotbringer: p => <g opacity="0.7">{[[9,16],[22,18],[15,22]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.6" fill={p.dark}/>)}</g>, // rot pustules
  brine_leech: p => <ellipse cx="21" cy="6.5" rx="2.2" ry="1.6" fill={p.accent} opacity="0.4"/>, // sucker mouth glow
  echo_knight: p => <g opacity="0.4">{[ -2, 2].map((dx,i)=><path key={i} d={`M${10+dx} 13 L${22+dx} 13 L${20+dx} 24 L${12+dx} 24 Z`} fill="none" stroke={p.eye} strokeWidth="0.5"/>)}</g>, // echo after-images
  ember_shade: p => <g>{[ [10,20],[22,22],[16,26]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="0.8" fill={p.accent} style={{filter:`drop-shadow(0 0 3px ${p.accent})`}}/>)}</g>, // floating embers
  glass_twin: p => <path d="M16 8 L16 30" stroke={p.accent} strokeWidth="0.5" opacity="0.5" strokeDasharray="1 1.5"/>, // mirror seam
  page_gnawer: p => <g opacity="0.8">{[[6,12],[26,14],[9,8]].map(([x,y],i)=><rect key={i} x={x} y={y} width="2.4" height="3" fill="#d8cba0" transform={`rotate(${i*30} ${x} ${y})`}/>)}</g>, // torn pages
  lexicon_wraith: p => <><rect x="4" y="6" width="3" height="4" fill="#d8cba0" opacity="0.8" transform="rotate(-20 5 8)"/><circle cx="27" cy="9" r="1" fill={p.accent} style={{filter:`drop-shadow(0 0 3px ${p.accent})`}}/></>, // floating page + rune
  cinder_imp: p => <g>{[[8,12],[24,12],[16,3]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="0.9" fill="#ffd060" style={{filter:'drop-shadow(0 0 4px #ff8844)'}}/>)}</g>, // sparks
  ash_warden: p => <g opacity="0.5">{[10,16,22].map((x,i)=><path key={i} d={`M${x} 5 q0 -3 1 -4`} stroke="#5a3a30" strokeWidth="1.4" fill="none"/>)}</g>, // smoke vents
  mirror_thrall: p => <g opacity="0.45">{[[9,14],[23,14]].map(([x,y],i)=><path key={i} d={`M${x} ${y} l3 8`} stroke={p.accent} strokeWidth="0.5"/>)}</g>, // shard reflections
  ink_scribe: p => <><path d="M5 7 L8 4" stroke="#08070c" strokeWidth="1.2"/><path d="M8 4 l-1 0.4 l0.4 1" fill="#08070c"/><circle cx="5" cy="7" r="0.6" fill={p.accent}/></>, // quill
  ice_revenant: p => <g opacity="0.8">{[12,16,20].map((x,i)=><polygon key={i} points={`${x},2 ${x+0.8},2 ${x+0.4},5`} fill="#dff0ff"/>)}</g>, // icicle crown
  bloodroot_fiend: p => <g opacity="0.8">{[6,11,21,26].map((x,i)=><path key={i} d={`M${x} 13 q${i%2?2:-2} -5 0 -9`} stroke={p.accent} strokeWidth="0.9" fill="none"/>)}</g>, // bloodroot vines
  iron_sentinel: p => <rect x="13.5" y="14" width="5" height="3" fill="none" stroke={p.accent} strokeWidth="0.6" opacity="0.7"/>, // chest sigil plate
  whisper_hound: p => <g opacity="0.5">{[[3,14],[5,12]].map(([x,y],i)=><path key={i} d={`M${x} ${y} q-2 1 -3 0`} stroke={p.accent} strokeWidth="0.5" fill="none"/>)}</g>, // whisper trails
  frost_crawler: p => <g opacity="0.7">{[[11,24],[20,18],[25.5,13]].map(([x,y],i)=><polygon key={i} points={`${x},${y-4} ${x+0.7},${y-4} ${x+0.35},${y-1.5}`} fill="#dff0ff"/>)}</g>, // back icicles
  vein_stalker: p => <g opacity="0.6">{[[11,24],[20,18]].map(([x,y],i)=><path key={i} d={`M${x-2} ${y} q2 -1.5 4 0`} stroke={p.accent} strokeWidth="0.6" fill="none"/>)}</g>, // pulsing veins
  rust_prophet: p => <g opacity="0.6">{[[10,18],[22,20]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.4" fill={p.dark}/>)}</g>, // rust holes
  chain_ghost: p => <g opacity="0.7">{[14,18].map((x,i)=><ellipse key={i} cx={x} cy="26" rx="1.3" ry="2.6" fill="none" stroke={p.light} strokeWidth="0.7"/>)}</g>, // dragging chains
  hymn_wretch: p => <g opacity="0.6">{[[8,8],[24,8],[12,4],[20,4]].map(([x,y],i)=><text key={i} x={x} y={y} fontSize="3" fill={p.accent}>♪</text>)}</g>, // hymn notes
  salt_ghoul: p => <g opacity="0.7">{[[10,15],[20,17],[14,21]].map(([x,y],i)=><rect key={i} x={x} y={y} width="1.6" height="1.6" fill="#dff0ff" transform={`rotate(45 ${x} ${y})`}/>)}</g>, // salt crystals
  ear_worm: p => <g opacity="0.6">{[[14,19],[20,18],[25,13]].map(([x,y],i)=><path key={i} d={`M${x} ${y} q2 -2 0 -4`} stroke={p.accent} strokeWidth="0.5" fill="none"/>)}</g>, // sound coils
  scale_skitter: p => <g opacity="0.7">{[[11,24],[15,19],[20,18],[25,13]].map(([x,y],i)=><path key={i} d={`M${x-2} ${y} q2 -2 4 0`} stroke={p.accent} strokeWidth="0.7" fill="none"/>)}</g>, // scales
  banner_void: p => <><rect x="14" y="5" width="4" height="14" fill={p.accent} opacity="0.3" {...outline(p.accent,0.4)}/><rect x="14.5" y="6" width="3" height="2" fill={p.accent} opacity="0.6"/></>, // void banner
  hive_warden: p => <g opacity="0.7">{[[10,17],[21,19],[14,21]].map(([x,y],i)=><polygon key={i} points={`${x},${y-1.6} ${x+1.4},${y-0.8} ${x+1.4},${y+0.8} ${x},${y+1.6} ${x-1.4},${y+0.8} ${x-1.4},${y-0.8}`} fill="none" stroke={p.accent} strokeWidth="0.5"/>)}</g>, // honeycomb
  sting_matron: p => <path d="M16 22 Q16 27 17 29 L18 27" stroke={p.accent} strokeWidth="1.4" fill="none"/>, // stinger
  starved_seraph: p => <g opacity="0.7">{[13.5,16,18.5].map((x,i)=><line key={i} x1={x} y1="14" x2={x} y2="26" stroke={p.dark} strokeWidth="0.4"/>)}</g>, // starved ribs vertical
  hollow_marcher: p => <ellipse cx="16" cy="9" rx="2.4" ry="2.8" fill={_ink}/>, // hollow visor void
  wyrm_spawn: p => <g opacity="0.7">{[[12,15],[20,15]].map(([x,y],i)=><path key={i} d={`M${x} ${y} l-2 -3`} stroke={p.accent} strokeWidth="0.7"/>)}</g>, // horn spikes
  the_called: p => <>{[[16,16,5]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={p.eye} strokeWidth="0.5" opacity="0.6"/>)}<circle cx="16" cy="16" r="1.4" fill={p.eye} style={{filter:`drop-shadow(0 0 6px ${p.eye})`}}/></>, // calling sigil
  null_weaver: p => <g opacity="0.6">{[[8,11],[24,11],[10,22],[22,22]].map(([x,y],i)=><line key={i} x1="16" y1="16" x2={x} y2={y} stroke={p.accent} strokeWidth="0.4"/>)}</g>, // web threads
  subboss_cairn_knight: p => <><rect x="10" y="15" width="12" height="2" fill={p.accent} opacity="0.5"/><circle cx="16" cy="16" r="1.2" fill={p.accent}/></>, // cairn rune sash
  subboss_veil_stalker: p => <g opacity="0.5">{[6,26].map((x,i)=><path key={i} d={`M${x} 8 Q${x} 20 ${x+(i?-3:3)} 30`} stroke={p.accent} strokeWidth="0.7" fill="none"/>)}</g>, // veil drapes
  subboss_iron_prior: p => <><rect x="13" y="13" width="6" height="4" fill="none" stroke={p.accent} strokeWidth="0.7"/><path d="M16 13 L16 17 M13 15 L19 15" stroke={p.accent} strokeWidth="0.5"/></>, // prior cross
  subboss_void_seraph: p => <g opacity="0.7">{[[16,5,5]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={p.accent} strokeWidth="0.6"/>)}</g>, // void halo
  boss_crypt_regent: p => <><path d="M11 12 L21 12 L19 16 L13 16 Z" fill={p.accent} opacity="0.5" {...outline(p.accent,0.4)}/><circle cx="16" cy="14" r="1.2" fill={p.accent} style={{filter:`drop-shadow(0 0 4px ${p.accent})`}}/></>, // regent chest jewel
  boss_ash_titan: p => <g>{[[8,16],[24,16],[16,10]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.2" fill={p.accent} style={{filter:`drop-shadow(0 0 5px ${p.accent})`}}/>)}</g>, // titan vents
  boss_sunless_oracle: p => <g opacity="0.8">{[0,60,120,180,240,300].map((a,i)=>{const r=a*Math.PI/180;return <line key={i} x1={16+Math.cos(r)*5} y1={6+Math.sin(r)*2} x2={16+Math.cos(r)*7} y2={6+Math.sin(r)*3} stroke={p.accent} strokeWidth="0.5"/>;})}</g>, // dark sun rays
  boss_the_below: p => <>{[[16,16,7],[16,16,4]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={p.eye} strokeWidth="0.5" opacity={0.6-i*0.2}/>)}<circle cx="16" cy="16" r="2" fill={_ink}/><circle cx="16" cy="16" r="1" fill={p.eye} style={{filter:`drop-shadow(0 0 8px ${p.eye})`}}/></>, // event horizon
};

// ═══════════════════════════════════════════════════════════════════════
// ENEMY SPECS (id → archetype + palette + feature opts + scale)
// ═══════════════════════════════════════════════════════════════════════
const ENEMY_SPECS = {
  goblin_scout:{arch:'humanoid',pal:'goblin',opts:{ears:true,weapon:'sword'}},
  skeleton_archer:{arch:'humanoid',pal:'bone',opts:{skull:true,weapon:'bow'}},
  cave_bat:{arch:'flyer',pal:'shadow',opts:{fangs:true}},
  shroud_crawler:{arch:'slime',pal:'shadow',opts:{tendrils:true}},
  candle_licker:{arch:'imp',pal:'candle',opts:{}},
  stone_golem:{arch:'golem',pal:'stone',opts:{coreGlow:true,runes:true}},
  grave_moss:{arch:'slime',pal:'moss',opts:{fungus:true}},
  bell_haunt:{arch:'wraith',pal:'bone',opts:{},gid:'bh'},
  marrow_hound:{arch:'beast',pal:'marrow',opts:{fangs:true,spines:true}},
  ossuary_moth:{arch:'flyer',pal:'bone',opts:{antennae:true}},
  shadow_wraith:{arch:'wraith',pal:'shadow',opts:{reach:true},gid:'sw'},
  deep_lurker:{arch:'beast',pal:'brine',opts:{fangs:true,spines:true,collar:true}},
  rotbringer:{arch:'slime',pal:'moss',opts:{fungus:true,tendrils:true}},
  brine_leech:{arch:'serpent',pal:'brine',opts:{segments:true,fangs:true}},
  echo_knight:{arch:'humanoid',pal:'stone',opts:{helm:true,pauldrons:true,weapon:'sword'}},
  ember_shade:{arch:'wraith',pal:'ember',opts:{},gid:'es'},
  glass_twin:{arch:'wraith',pal:'glass',opts:{reach:true},gid:'gt'},
  page_gnawer:{arch:'beast',pal:'ink',opts:{fangs:true}},
  lexicon_wraith:{arch:'caster',pal:'ink',opts:{tome:true},gid:'lw'},
  cinder_imp:{arch:'imp',pal:'ember',opts:{flame:true}},
  ash_warden:{arch:'golem',pal:'ember',opts:{coreGlow:true}},
  mirror_thrall:{arch:'wraith',pal:'glass',opts:{reach:true,crown:true},gid:'mt'},
  ink_scribe:{arch:'caster',pal:'ink',opts:{tome:true,halo:true},gid:'is'},
  ice_revenant:{arch:'humanoid',pal:'ice',opts:{skull:true,pauldrons:true}},
  bloodroot_fiend:{arch:'slime',pal:'blood',opts:{tendrils:true,fungus:true}},
  iron_sentinel:{arch:'golem',pal:'iron',opts:{coreGlow:true,runes:true,crown:true}},
  whisper_hound:{arch:'beast',pal:'pale',opts:{fangs:true,spines:true}},
  frost_crawler:{arch:'serpent',pal:'ice',opts:{segments:true,frill:true}},
  vein_stalker:{arch:'serpent',pal:'blood',opts:{segments:true,fangs:true}},
  rust_prophet:{arch:'caster',pal:'rust',opts:{staff:true},gid:'rp'},
  chain_ghost:{arch:'wraith',pal:'iron',opts:{chains:true,reach:true},gid:'cg'},
  hymn_wretch:{arch:'caster',pal:'bone',opts:{halo:true,staff:true},gid:'hw'},
  salt_ghoul:{arch:'golem',pal:'brine',opts:{}},
  ear_worm:{arch:'serpent',pal:'pale',opts:{segments:true,frill:true}},
  scale_skitter:{arch:'serpent',pal:'wyrm',opts:{segments:true,fangs:true,frill:true}},
  banner_void:{arch:'golem',pal:'void',opts:{coreGlow:true,crown:true}},
  hive_warden:{arch:'humanoid',pal:'hive',opts:{horns:true,pauldrons:true}},
  sting_matron:{arch:'flyer',pal:'hive',opts:{antennae:true,tail:true}},
  starved_seraph:{arch:'seraph',pal:'pale',opts:{ribs:true,blindfold:true,halo:true},gid:'ss'},
  hollow_marcher:{arch:'humanoid',pal:'iron',opts:{helm:true,pauldrons:true,weapon:'sword',cloak:true}},
  wyrm_spawn:{arch:'flyer',pal:'wyrm',opts:{fangs:true,tail:true}},
  the_called:{arch:'wraith',pal:'void',opts:{reach:true,crown:true,chains:true},gid:'tc'},
  null_weaver:{arch:'seraph',pal:'void',opts:{manyEyes:true,ribs:true},gid:'nw'},
  subboss_cairn_knight:{arch:'humanoid',pal:'stone',opts:{helm:true,pauldrons:true,weapon:'sword',cloak:true},scale:1.15},
  subboss_veil_stalker:{arch:'wraith',pal:'shadow',opts:{reach:true,crown:true,chains:true},gid:'vs',scale:1.15},
  subboss_iron_prior:{arch:'golem',pal:'iron',opts:{coreGlow:true,crown:true,runes:true},scale:1.15},
  subboss_void_seraph:{arch:'seraph',pal:'void',opts:{halo:true,ribs:true,manyEyes:true},gid:'vsr',scale:1.15},
  boss_crypt_regent:{arch:'humanoid',pal:'regent',opts:{skull:true,pauldrons:true,weapon:'scythe',cloak:true,horns:true},scale:1.3},
  boss_ash_titan:{arch:'golem',pal:'titan',opts:{coreGlow:true,crown:true,runes:true},scale:1.35},
  boss_sunless_oracle:{arch:'caster',pal:'oracle',opts:{staff:true,halo:true,tome:true},gid:'so',scale:1.3},
  boss_the_below:{arch:'wraith',pal:'below',opts:{reach:true,crown:true,chains:true},gid:'tb',scale:1.4},
};

const ENEMY_META = {
  goblin_scout:'Goblin Scout',skeleton_archer:'Skeleton Archer',cave_bat:'Cave Bat',
  shroud_crawler:'Shroud Crawler',candle_licker:'Candle Licker',stone_golem:'Stone Golem',
  grave_moss:'Grave Moss',bell_haunt:'Bell Haunt',marrow_hound:'Marrow Hound',
  ossuary_moth:'Ossuary Moth',shadow_wraith:'Shadow Wraith',deep_lurker:'Deep Lurker',
  rotbringer:'Rotbringer',brine_leech:'Brine Leech',echo_knight:'Echo Knight',
  ember_shade:'Ember Shade',glass_twin:'Glass Twin',page_gnawer:'Page Gnawer',
  lexicon_wraith:'Lexicon Wraith',cinder_imp:'Cinder Imp',ash_warden:'Ash Warden',
  mirror_thrall:'Mirror Thrall',ink_scribe:'Ink Scribe',ice_revenant:'Ice Revenant',
  bloodroot_fiend:'Bloodroot Fiend',iron_sentinel:'Iron Sentinel',whisper_hound:'Whisper Hound',
  frost_crawler:'Frost Crawler',vein_stalker:'Vein Stalker',rust_prophet:'Rust Prophet',
  chain_ghost:'Chain Ghost',hymn_wretch:'Hymn Wretch',salt_ghoul:'Salt Ghoul',
  ear_worm:'Ear Worm',scale_skitter:'Scale Skitter',banner_void:'Banner Void',
  hive_warden:'Hive Warden',sting_matron:'Sting Matron',starved_seraph:'Starved Seraph',
  hollow_marcher:'Hollow Marcher',wyrm_spawn:'Wyrm Spawn',the_called:'The Called',
  null_weaver:'Null Weaver',subboss_cairn_knight:'Cairn Knight',subboss_veil_stalker:'Veil Stalker',
  subboss_iron_prior:'Iron Prior',subboss_void_seraph:'Void Seraph',boss_crypt_regent:'Crypt Regent',
  boss_ash_titan:'Ash Titan',boss_sunless_oracle:'Sunless Oracle',boss_the_below:'The Below',
};

// ═══════════════════════════════════════════════════════════════════════
// SVG STRING BUILDER — identical markup to the React <EnemySprite/>, minus
// the React runtime. Used both standalone and by the canvas rasteriser.
// ═══════════════════════════════════════════════════════════════════════
const ENEMY_MARGIN = 4;
const ENEMY_VB = 32 + ENEMY_MARGIN * 2; // 40
const ENEMY_OVERSCAN = ENEMY_MARGIN / 32; // 0.125

export function enemySpriteSVG(id, px = 256) {
  const spec = ENEMY_SPECS[id];
  if (!spec) return '';
  const p = PAL[spec.pal];
  const render = ARCH[spec.arch];
  const sig = SIG[id];
  const sc = spec.scale || 1;
  const body = render(p, spec.opts || {}, spec.gid || spec.arch) + (sig ? sig(p) : '');
  const inner = sc !== 1
    ? `<g transform="translate(16 16) scale(${sc}) translate(-16 -16)">${body}</g>`
    : body;
  // Margin around the 32-grid so wings/weapons/reach/glow filters that extend
  // past the body aren't clipped by the fixed raster box. drawVectorEnemy
  // overscans by the matching fraction so the body keeps its on-tile size.
  return `<svg xmlns="http://www.w3.org/2000/svg" `
    + `viewBox="${-ENEMY_MARGIN} ${-ENEMY_MARGIN} ${ENEMY_VB} ${ENEMY_VB}" `
    + `width="${px}" height="${px}" style="overflow:visible">${inner}</svg>`;
}

export const enemyVectorIds = Object.keys(ENEMY_SPECS);
export function hasVectorSprite(id) { return !!ENEMY_SPECS[id]; }
export { ENEMY_SPECS, ENEMY_META, PAL, SIG, ARCH_ANIM };

// ═══════════════════════════════════════════════════════════════════════
// CANVAS RASTERISER — render each enemy's SVG to an Image once, then blit.
// Synchronous draw: returns false until the Image has decoded (caller falls
// back to the legacy grid sprite for those first frames), true once ready.
// ═══════════════════════════════════════════════════════════════════════
const RASTER_PX = 256; // base resolution; scaled down per draw for crisp edges
const _imgCache = new Map(); // id → { img, ready, error }

function _getEnemyImage(id) {
  let rec = _imgCache.get(id);
  if (rec) return rec;
  rec = { img: null, ready: false, error: false };
  _imgCache.set(id, rec);
  if (typeof Image === 'undefined') { rec.error = true; return rec; }
  const svg = enemySpriteSVG(id, RASTER_PX);
  if (!svg) { rec.error = true; return rec; }
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { rec.img = img; rec.ready = true; };
  img.onerror = () => { rec.error = true; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  rec.img = img;
  return rec;
}

/** Kick off rasterisation of every enemy sprite (call once at boot). */
export function preloadVectorEnemies() {
  for (const id of enemyVectorIds) _getEnemyImage(id);
}

/**
 * Draw enemy `id` into (x,y) at `size`×`size`. Returns true if it drew the
 * vector sprite, false if its image isn't ready yet (or id is unknown).
 */
export function drawVectorEnemy(ctx, x, y, size, id) {
  if (!ENEMY_SPECS[id]) return false;
  const rec = _getEnemyImage(id);
  if (!rec.ready || !rec.img) return false;
  const o = size * ENEMY_OVERSCAN;
  ctx.drawImage(rec.img, x - o, y - o, size + 2 * o, size + 2 * o);
  return true;
}

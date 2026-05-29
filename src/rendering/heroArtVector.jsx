// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Hero Art Engine — 8 detailed, hand-built hero sprites
//  Same style as the enemy engine: multi-tone shading, ink outlines,
//  glowing eyes, capes/robes, signature weapons & gear. viewBox 0 0 32 32.
//
//  In-engine port of the `hero-art.jsx` handoff: the art code (HPAL, shared
//  sub-parts, HERO_ART, HERO_INFO) is verbatim — only the React runtime is
//  swapped for the h()/Fragment hyperscript so the emitted SVG is identical.
//  Sprites are rasterised once per kind and blitted onto the game canvas.
//
//  kind ∈ vigil hollow inquisitor reaver pilgrim warden bladedancer echobinder
// ═══════════════════════════════════════════════════════════════════════
import { h, Fragment } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const HINK = '#08070c';
const ol = (c = HINK, w = 0.7) => ({ stroke: c, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round' });
const Eye = (cx, cy, r, col, k) => (
  <g key={k}>
    <circle cx={cx} cy={cy} r={r} fill={col} style={{ filter: `drop-shadow(0 0 ${r * 1.9}px ${col})` }} />
    <circle cx={cx} cy={cy} r={r * 0.4} fill="#fff" opacity="0.9" />
  </g>
);

// ── per-hero palettes ──────────────────────────────────────────────────
const HPAL = {
  vigil:      { dark:'#2a3340', mid:'#46566a', light:'#7d90a8', metal:'#5d6f86', steel:'#aab4c4', steelL:'#e6ecf5', gold:'#c79a4e', goldL:'#f0d68a', accent:'#a83232', accentD:'#5e1a1a', eye:'#bcd6ff' },
  hollow:     { dark:'#221a1e', mid:'#3c3036', light:'#675a60', metal:'#4a424a', steel:'#8a7e86', gold:'#7a5a30', goldL:'#caa460', accent:'#33282e', accentD:'#150f13', eye:'#9ec8ff' },
  inquisitor: { dark:'#241a28', mid:'#3c2e44', light:'#5f4c68', metal:'#4a3a52', steel:'#7a6684', gold:'#c79a4e', goldL:'#ffe39a', accent:'#2c2036', accentD:'#160e1e', eye:'#ffb04a' },
  reaver:     { dark:'#36281f', mid:'#564434', light:'#cabd96', metal:'#e6dcb4', steel:'#b0a988', gold:'#8a6a36', goldL:'#caa460', accent:'#7a1f1f', accentD:'#3a0c0c', eye:'#ff5a3a' },
  pilgrim:    { dark:'#2c241d', mid:'#473a2c', light:'#6e5e46', metal:'#5a4a36', steel:'#8a7a60', gold:'#c79a4e', goldL:'#ffe39a', accent:'#3a3024', accentD:'#1e180f', eye:'#f0c45a' },
  warden:     { dark:'#26303c', mid:'#41526a', light:'#7388a4', metal:'#5a6c84', steel:'#aeb9c8', steelL:'#e2e9f2', gold:'#b89050', goldL:'#ecd28a', accent:'#37496a', accentD:'#1c2740', eye:'#bcd6ff' },
  bladedancer:{ dark:'#281e22', mid:'#473733', light:'#7a665c', metal:'#6a564a', steel:'#cdd4de', steelL:'#f2f5fa', gold:'#c08a4a', goldL:'#f0cf8a', accent:'#b03038', accentD:'#5e1418', eye:'#ff8844' },
  echobinder: { dark:'#190f2c', mid:'#2e1f4e', light:'#5a3f86', metal:'#3c2a60', steel:'#8a6cc0', gold:'#9a40e8', goldL:'#c79bff', accent:'#9a40e8', accentD:'#3a1066', eye:'#d07bff' },
};

// ── shared sub-parts ───────────────────────────────────────────────────
const greaves = (p) => (<>
  <rect x="12" y="23" width="3.4" height="7" rx="0.6" fill={p.dark} {...ol()} />
  <rect x="16.6" y="23" width="3.4" height="7" rx="0.6" fill={p.dark} {...ol()} />
  <rect x="11.5" y="28.6" width="4.5" height="2" fill={p.metal} {...ol()} />
  <rect x="16.1" y="28.6" width="4.5" height="2" fill={p.metal} {...ol()} />
  <rect x="12.4" y="24" width="0.8" height="5" fill={p.light} opacity="0.45" />
  <rect x="17" y="24" width="0.8" height="5" fill={p.light} opacity="0.45" />
</>);

const lantern = (x, y, glow) => (<>
  <rect x={x - 0.4} y={y - 0.6} width="2.8" height="1" fill="#3a2a18" {...ol(HINK, 0.4)} />
  <rect x={x} y={y} width="2" height="3.2" rx="0.3" fill={glow} opacity="0.95" style={{ filter: `drop-shadow(0 0 2.4px ${glow})` }} />
  <rect x={x + 0.7} y={y + 0.4} width="0.7" height="2.4" fill="#fff" opacity="0.7" />
  <rect x={x - 0.2} y={y + 3.2} width="2.4" height="0.8" fill="#3a2a18" {...ol(HINK, 0.4)} />
</>);

// ── 8 hero bodies ──────────────────────────────────────────────────────
const HERO_ART = {
  // 1 · VIGIL KNIGHT — plate, crimson cape, gold visor, longsword
  vigil: (p) => (<>
    <path d="M10 13 Q3.5 24 7 31 L12.5 30 L11.5 14 Z" fill={p.accent} {...ol()} />
    <path d="M22 13 Q28.5 24 25 31 L19.5 30 L20.5 14 Z" fill={p.accent} {...ol()} />
    <path d="M11.5 14 L20.5 14 L19.5 30 L12.5 30 Z" fill={p.accentD} opacity="0.55" />
    {greaves(p)}
    <path d="M9.4 13 L22.6 13 L21 24 L11 24 Z" fill={p.mid} {...ol()} />
    <path d="M9.4 13 L16 13 L15.4 24 L11 24 Z" fill={p.dark} opacity="0.4" />
    <path d="M16 13 L16 24" stroke={p.light} strokeWidth="0.5" opacity="0.4" />
    <path d="M12 18.5 Q16 20 20 18.5" stroke={HINK} strokeWidth="0.5" fill="none" opacity="0.5" />
    <rect x="10.5" y="20" width="11" height="2" fill={p.gold} {...ol(HINK, 0.5)} />
    <circle cx="16" cy="21" r="0.9" fill={p.goldL} />
    <rect x="6.8" y="14" width="3.2" height="9" rx="0.6" fill={p.mid} {...ol()} />
    <rect x="22" y="14" width="3.2" height="9" rx="0.6" fill={p.mid} {...ol()} />
    <ellipse cx="8.4" cy="14.4" rx="3.4" ry="2.8" fill={p.metal} {...ol()} />
    <ellipse cx="23.6" cy="14.4" rx="3.4" ry="2.8" fill={p.metal} {...ol()} />
    <ellipse cx="8.4" cy="13.6" rx="2" ry="1.1" fill="#fff" opacity="0.25" />
    <ellipse cx="23.6" cy="13.6" rx="2" ry="1.1" fill="#fff" opacity="0.25" />
    <rect x="24.2" y="5" width="1.8" height="16.5" fill={p.steel} {...ol(HINK, 0.5)} />
    <rect x="24.6" y="6" width="0.6" height="13.5" fill="#fff" opacity="0.5" />
    <path d="M25.1 3.4 L26.4 6 L23.6 6 Z" fill={p.steelL} {...ol(HINK, 0.4)} />
    <rect x="22.2" y="20.2" width="5.6" height="1.8" rx="0.4" fill={p.gold} {...ol(HINK, 0.5)} />
    <path d="M10.8 5 Q16 1.4 21.2 5 L21 12.4 L11 12.4 Z" fill={p.metal} {...ol()} />
    <path d="M11 5.2 Q16 2.2 21 5.2" stroke="#fff" strokeWidth="0.5" opacity="0.35" fill="none" />
    <rect x="15.4" y="3.2" width="1.2" height="9.2" fill={p.steelL} opacity="0.5" />
    <rect x="11" y="7.4" width="10" height="2.8" fill={HINK} />
    <rect x="11" y="7.4" width="10" height="0.8" fill={p.gold} />
    {Eye(13.6, 9, 1, p.eye, 'a')}{Eye(18.4, 9, 1, p.eye, 'b')}
    <path d="M16 1.5 Q15.5 -1.4 18.2 -0.8 Q16.8 1.4 16 1.6 Z" fill={p.accent} {...ol(HINK, 0.4)} />
  </>),

  // 2 · HOLLOW CRUSADER — cracked helm, tattered cloak, single eye
  hollow: (p) => (<>
    <path d="M9 12 Q2.5 23 6 31 L12 30 L11 13 Z" fill={p.accent} {...ol()} />
    <path d="M23 12 Q29.5 23 26 31 L20 30 L21 13 Z" fill={p.accent} {...ol()} />
    <path d="M12 27 L13.5 31 L15 27 Z" fill={p.dark} />
    <path d="M17 27 L18.5 31 L20 27 Z" fill={p.dark} />
    <path d="M11 13 L21 13 L20 30 L12 30 Z" fill={p.accentD} opacity="0.6" />
    {greaves(p)}
    <path d="M9.6 12.6 L22.4 12.6 L20.8 24 L11.2 24 Z" fill={p.mid} {...ol()} />
    <path d="M9.6 12.6 L16 12.6 L15.4 24 L11.2 24 Z" fill={p.dark} opacity="0.5" />
    <path d="M13 16 L14 21" stroke={HINK} strokeWidth="0.5" opacity="0.55" />
    <path d="M18 15 L17.4 22" stroke={HINK} strokeWidth="0.5" opacity="0.55" />
    <rect x="10.6" y="19.6" width="10.8" height="1.8" fill={p.gold} opacity="0.8" {...ol(HINK, 0.5)} />
    <rect x="6.6" y="13.4" width="3.2" height="9" rx="0.5" fill={p.mid} {...ol()} />
    <rect x="22.2" y="13.4" width="3.2" height="9" rx="0.5" fill={p.mid} {...ol()} />
    <ellipse cx="8.2" cy="13.8" rx="3.1" ry="2.5" fill={p.metal} {...ol()} />
    <ellipse cx="23.8" cy="13.8" rx="3.1" ry="2.5" fill={p.metal} {...ol()} />
    <path d="M5.6 13 L7 11 L8 13.4 Z" fill={p.metal} {...ol(HINK, 0.4)} />
    <path d="M10.6 5.4 Q16 1.8 21.4 5.4 L21 12 L11 12 Z" fill={p.metal} {...ol()} />
    <path d="M14.4 2.6 L13 6 L15.6 5.4 Z" fill={p.dark} {...ol(HINK, 0.4)} />
    <path d="M18.5 4 L19.6 7.5 L20.8 5 Z" fill={HINK} opacity="0.85" />
    <rect x="11" y="7.6" width="10" height="2.4" fill={HINK} />
    {Eye(13.4, 8.8, 1.15, p.eye, 'a')}
    <path d="M17.4 8 L19.4 8.2 L18.4 9.6 Z" fill={HINK} />
    <path d="M11.2 11.4 L20.8 11.4" stroke={HINK} strokeWidth="0.5" opacity="0.5" />
  </>),

  // 3 · WANDERING INQUISITOR — hood, raised lantern, faith seal
  inquisitor: (p) => (<>
    <path d="M8.5 12 Q7 24 9 31 L23 31 Q25 24 23.5 12 Z" fill={p.mid} {...ol()} />
    <path d="M8.5 12 Q7 24 9 31 L16 31 L16 12 Z" fill={p.dark} opacity="0.4" />
    <path d="M16 14 L16 31" stroke={p.light} strokeWidth="0.5" opacity="0.3" />
    <path d="M12 22 Q16 23.5 20 22" stroke={HINK} strokeWidth="0.5" fill="none" opacity="0.4" />
    <rect x="10.5" y="18" width="11" height="2" fill={p.gold} {...ol(HINK, 0.5)} />
    <path d="M14.4 19 L16 22 L17.6 19 Z" fill={p.goldL} {...ol(HINK, 0.4)} />
    <rect x="21.4" y="13" width="2.6" height="9.5" rx="0.5" fill={p.mid} {...ol()} />
    <rect x="6.6" y="6.5" width="2.4" height="6" fill="#3a2a18" {...ol(HINK, 0.4)} />
    {lantern(6.2, 5.4, p.eye)}
    <path d="M9 12.6 L6.6 9" stroke={p.mid} strokeWidth="2.4" {...ol()} />
    <path d="M10.4 4.6 Q16 -0.6 21.6 4.6 Q23 9.4 20.6 12.6 L11.4 12.6 Q9 9.4 10.4 4.6 Z" fill={p.metal} {...ol()} />
    <path d="M10.8 5 Q16 0.2 21.2 5" stroke={p.light} strokeWidth="0.6" opacity="0.4" fill="none" />
    <path d="M12.6 9.2 Q16 6.6 19.4 9.2 L18.4 12 L13.6 12 Z" fill={HINK} />
    {Eye(14.2, 9.8, 0.95, p.eye, 'a')}{Eye(17.8, 9.8, 0.95, p.eye, 'b')}
    <rect x="15.6" y="13.4" width="0.8" height="4.2" fill={p.gold} />
    <rect x="14.4" y="14.6" width="3.2" height="0.8" fill={p.gold} />
  </>),

  // 4 · BONE REAVER — skull mask, spiked bone pauldrons, blood pact
  reaver: (p) => (<>
    {greaves(p)}
    <path d="M9.6 13 L22.4 13 L21 24 L11 24 Z" fill={p.mid} {...ol()} />
    <path d="M9.6 13 L16 13 L15.4 24 L11 24 Z" fill={p.dark} opacity="0.45" />
    {[14, 17, 20].map((y, i) => <path key={i} d={`M11.5 ${y} L20.5 ${y}`} stroke={p.light} strokeWidth="0.7" opacity="0.6" />)}
    {[14, 17, 20].map((y, i) => <path key={'d' + i} d={`M11.5 ${y + 0.6} L20.5 ${y + 0.6}`} stroke={HINK} strokeWidth="0.4" opacity="0.5" />)}
    <path d="M14 24 L16 27 L18 24 Z" fill={p.accent} opacity="0.85" />
    <rect x="6.6" y="14" width="3.2" height="9" rx="0.5" fill={p.mid} {...ol()} />
    <rect x="22.2" y="14" width="3.2" height="9" rx="0.5" fill={p.mid} {...ol()} />
    <path d="M5 14.6 Q8.2 10.4 11 14.6 Q8 16.4 5 14.6 Z" fill={p.metal} {...ol()} />
    <path d="M21 14.6 Q23.8 10.4 27 14.6 Q24 16.4 21 14.6 Z" fill={p.metal} {...ol()} />
    <path d="M6.2 12.8 L6.8 10.6 L7.6 12.8 Z" fill={p.metal} {...ol(HINK, 0.4)} />
    <path d="M24.4 12.8 L25.2 10.6 L25.8 12.8 Z" fill={p.metal} {...ol(HINK, 0.4)} />
    <ellipse cx="16" cy="8.4" rx="5.4" ry="5.8" fill={p.light} {...ol()} />
    <ellipse cx="13.8" cy="6.6" rx="1.7" ry="1.2" fill="#fff" opacity="0.3" />
    <ellipse cx="13.6" cy="8.4" rx="1.9" ry="2.1" fill={HINK} />
    <ellipse cx="18.4" cy="8.4" rx="1.9" ry="2.1" fill={HINK} />
    {Eye(13.6, 8.5, 0.95, p.eye, 'a')}{Eye(18.4, 8.5, 0.95, p.eye, 'b')}
    <path d="M15.2 10.4 L16 12.2 L16.8 10.4 Z" fill={HINK} />
    <rect x="12.6" y="12.6" width="6.8" height="2.8" fill={p.light} {...ol(HINK, 0.5)} />
    {[13.2, 15, 16.8].map((x, i) => <rect key={i} x={x} y="12.8" width="1.2" height="2.4" fill={HINK} />)}
  </>),

  // 5 · ASHEN PILGRIM — wide-brim hat, travel coat, lantern staff
  pilgrim: (p) => (<>
    <path d="M9 14 Q7.5 24 9.5 31 L22.5 31 Q24.5 24 23 14 Z" fill={p.mid} {...ol()} />
    <path d="M9 14 Q7.5 24 9.5 31 L16 31 L16 14 Z" fill={p.dark} opacity="0.4" />
    <path d="M16 15 L16 31" stroke={p.light} strokeWidth="0.5" opacity="0.3" />
    <path d="M11 14 L11 30 M21 14 L21 30" stroke={HINK} strokeWidth="0.5" opacity="0.4" />
    <rect x="10.5" y="20" width="11" height="1.8" fill={p.gold} {...ol(HINK, 0.5)} />
    <rect x="24.4" y="3" width="1.6" height="24" rx="0.4" fill="#4a3a26" {...ol(HINK, 0.5)} />
    <path d="M25.2 27 L24 30 L26.4 30 Z" fill="#4a3a26" {...ol(HINK, 0.4)} />
    {lantern(23.6, 2.4, p.eye)}
    <path d="M22 14 L24.6 4" stroke={p.mid} strokeWidth="2.4" {...ol()} />
    <path d="M10 13 L22 13 L21 17 L11 17 Z" fill={p.dark} {...ol()} />
    <ellipse cx="16" cy="8.8" rx="4.4" ry="4.8" fill={p.light} {...ol()} />
    <path d="M11.4 10.6 L20.6 10.6 L18.4 12.6 L13.6 12.6 Z" fill={HINK} opacity="0.55" />
    {Eye(14.2, 9.4, 0.9, p.eye, 'a')}{Eye(17.8, 9.4, 0.9, p.eye, 'b')}
    <path d="M5.5 7 Q16 1.5 26.5 7 Q16 9.6 5.5 7 Z" fill={p.dark} {...ol()} />
    <path d="M11 6 Q16 2.6 21 6 L20 8 L12 8 Z" fill={p.mid} {...ol()} />
    <rect x="11.5" y="7.4" width="9" height="1.4" fill={p.gold} {...ol(HINK, 0.4)} />
    <path d="M6.5 7 Q16 4.6 25.5 7" stroke={p.light} strokeWidth="0.5" opacity="0.35" fill="none" />
  </>),

  // 6 · TOWER WARDEN — heavy plate, great tower shield
  warden: (p) => (<>
    {greaves(p)}
    <path d="M9 12 L23 12 L21.4 24 L10.6 24 Z" fill={p.mid} {...ol()} />
    <path d="M9 12 L16 12 L15.4 24 L10.6 24 Z" fill={p.dark} opacity="0.45" />
    <rect x="5.4" y="13" width="3.4" height="9.5" rx="0.6" fill={p.mid} {...ol()} />
    <rect x="23.2" y="13" width="3.4" height="9.5" rx="0.6" fill={p.mid} {...ol()} />
    <ellipse cx="7.4" cy="13.2" rx="3.8" ry="3" fill={p.steel} {...ol()} />
    <ellipse cx="24.6" cy="13.2" rx="3.8" ry="3" fill={p.steel} {...ol()} />
    <ellipse cx="7.4" cy="12.2" rx="2.2" ry="1.2" fill="#fff" opacity="0.28" />
    <path d="M9.6 4.8 Q16 1.4 22.4 4.8 L22 12.6 L10 12.6 Z" fill={p.steel} {...ol()} />
    <rect x="15.4" y="2.8" width="1.2" height="9.8" fill={p.steelL} opacity="0.55" />
    <rect x="10" y="7.4" width="12" height="2.6" fill={HINK} />
    {Eye(13.4, 8.7, 1, p.eye, 'a')}{Eye(18.6, 8.7, 1, p.eye, 'b')}
    <path d="M10 4.9 Q16 1.8 22 4.9" stroke="#fff" strokeWidth="0.5" opacity="0.4" fill="none" />
    {/* tower shield, front-left */}
    <path d="M3 11 L13.5 11 Q14 22 8 27 Q2 22 3 11 Z" fill={p.accent} {...ol(HINK, 0.9)} />
    <path d="M3 11 L8 11 Q8 22 8 27 Q3.5 22 3 11 Z" fill={p.accentD} opacity="0.5" />
    <rect x="7.4" y="11.4" width="1.2" height="14" fill={p.steelL} opacity="0.55" />
    <path d="M3.6 12 L13 12" stroke={p.gold} strokeWidth="1" {...ol(HINK, 0.4)} />
    <circle cx="8" cy="17.5" r="2.1" fill={p.gold} {...ol(HINK, 0.5)} />
    <circle cx="8" cy="17.5" r="0.9" fill={p.goldL} />
  </>),

  // 7 · BLADE DANCER — twin daggers, crimson sash, agile leathers
  bladedancer: (p) => (<>
    <path d="M11 14 Q9 24 11 30 L21 30 Q23 24 21 14 Z" fill={p.mid} {...ol()} />
    {greaves(p)}
    <path d="M10.4 13 L21.6 13 L20.4 23 L11.6 23 Z" fill={p.mid} {...ol()} />
    <path d="M10.4 13 L16 13 L15.6 23 L11.6 23 Z" fill={p.dark} opacity="0.45" />
    <path d="M10.8 14.5 L21 19.5 L20.6 21.5 L10.6 16.5 Z" fill={p.accent} {...ol(HINK, 0.5)} />
    <path d="M19.4 18.8 L22 22 L20.8 18.2 Z" fill={p.accent} {...ol(HINK, 0.4)} />
    <rect x="7.2" y="13.6" width="2.8" height="8" rx="0.5" fill={p.mid} {...ol()} transform="rotate(14 8.6 17)" />
    <rect x="22" y="13.6" width="2.8" height="8" rx="0.5" fill={p.mid} {...ol()} transform="rotate(-14 23.4 17)" />
    {/* left dagger (down) */}
    <g transform="rotate(20 6 20)">
      <rect x="5.2" y="18" width="1.6" height="8" fill={p.steel} {...ol(HINK, 0.45)} />
      <path d="M6 26.4 L5 25 L7 25 Z" fill={p.steelL} />
      <rect x="4.2" y="16.6" width="3.6" height="1.4" fill={p.gold} {...ol(HINK, 0.4)} />
    </g>
    {/* right dagger (up) */}
    <g transform="rotate(-18 26 14)">
      <rect x="25.2" y="6" width="1.6" height="9" fill={p.steel} {...ol(HINK, 0.45)} />
      <path d="M26 4.4 L25 6 L27 6 Z" fill={p.steelL} />
      <rect x="24.2" y="14.6" width="3.6" height="1.4" fill={p.gold} {...ol(HINK, 0.4)} />
    </g>
    <ellipse cx="16" cy="8.6" rx="4.8" ry="5.2" fill={p.light} {...ol()} />
    <ellipse cx="14" cy="6.8" rx="1.5" ry="1.1" fill="#fff" opacity="0.25" />
    <path d="M11.4 6.6 Q16 3.6 20.6 6.6 L20.6 5 Q16 2 11.4 5 Z" fill={p.dark} {...ol()} />
    <path d="M20.4 6 Q24 7 23 11" stroke={p.accent} strokeWidth="1.4" fill="none" {...ol(HINK, 0.3)} />
    {Eye(14, 9, 1, p.eye, 'a')}{Eye(18, 9, 1, p.eye, 'b')}
    <path d="M14.4 11.4 Q16 12.6 17.6 11.4" stroke={p.dark} strokeWidth="0.6" fill="none" />
  </>),

  // 8 · ECHOBINDER — voidchoir robe, sonic glow, no legs (floating)
  echobinder: (p) => (<>
    <ellipse cx="16" cy="16" rx="13" ry="13" fill={p.accent} opacity="0.1" />
    {[6, 9, 12].map((r, i) => (
      <circle key={i} cx="23" cy="12" r={r} fill="none" stroke={p.goldL} strokeWidth="0.5" opacity={0.5 - i * 0.13} />
    ))}
    <path d="M8.5 13 Q6 26 9 31 L23 31 Q26 26 23.5 13 Q20 9 16 9 Q12 9 8.5 13 Z" fill={p.mid} {...ol()} />
    <path d="M8.5 13 Q6 26 9 31 L16 31 L16 9 Q12 9 8.5 13 Z" fill={p.dark} opacity="0.5" />
    {[11, 16, 21].map((x, i) => <path key={i} d={`M${x} 13 L${x} 31`} stroke={HINK} strokeWidth="0.5" opacity="0.4" />)}
    <path d="M10 24 Q16 26 22 24" stroke={p.accent} strokeWidth="0.7" fill="none" opacity="0.8" />
    <rect x="10.5" y="17" width="11" height="2" fill={p.gold} opacity="0.85" {...ol(HINK, 0.4)} />
    <path d="M13.4 18 L16 16 L18.6 18 L16 20 Z" fill={p.goldL} {...ol(HINK, 0.4)} />
    <path d="M8.8 13 L5.6 22" stroke={p.mid} strokeWidth="2.6" {...ol()} />
    <path d="M23.2 13 L26.4 22" stroke={p.mid} strokeWidth="2.6" {...ol()} />
    <circle cx="5.4" cy="22.4" r="1.5" fill={p.accent} style={{ filter: `drop-shadow(0 0 2px ${p.accent})` }} {...ol(HINK, 0.4)} />
    <path d="M11 6 Q16 1.6 21 6 Q22.4 10 20 12.8 L12 12.8 Q9.6 10 11 6 Z" fill={p.metal} {...ol()} />
    <path d="M12.6 9 Q16 6.4 19.4 9 L18.6 12.4 L13.4 12.4 Z" fill={HINK} />
    {Eye(14.1, 9.6, 0.85, p.eye, 'a')}{Eye(17.9, 9.6, 0.85, p.eye, 'b')}
    {Eye(16, 7.4, 0.6, p.goldL, 'c')}
  </>),
};

const HERO_INFO = {
  vigil:      { name:'The Vigil Knight',         sub:'Last of an order that no longer exists.',         tags:['Plate','Crimson cape','Gold visor'],            stats:{ATK:4,DEF:5,DEX:2,TORCH:5}, spell:{name:'Bulwark',         cd:7,            color:'#80b0ff', desc:'Heal and raise DEF for a few turns.'} },
  hollow:     { name:'The Hollow Crusader',      sub:'His name dropped off somewhere on floor IV.',     tags:['Broken helm','Tattered cloak','One eye'],       stats:{ATK:6,DEF:3,DEX:1,TORCH:4}, spell:{name:'Siphon',          cd:6, rng:6,      color:'#9a60ff', desc:'Drain the nearest visible enemy.'} },
  inquisitor: { name:'The Wandering Inquisitor', sub:'She brought her own light. Of course she did.',   tags:['Hood','Lantern','Faith-locked'],                stats:{ATK:3,DEF:2,DEX:4,TORCH:7}, spell:{name:'Lantern',         cd:7, rng:6, ar:1, color:'#f0b860', desc:'Burn a small cluster around a target.'} },
  reaver:     { name:'The Bone Reaver',          sub:'Wears what is left of better men.',               tags:['Skull mask','Bone pauldrons','Blood pact'],     stats:{ATK:5,DEF:4,DEX:3,TORCH:3}, spell:{name:'Bone Storm',      cd:5, ar:2,      color:'#e8e0d0', desc:'Damage all nearby enemies.'} },
  pilgrim:    { name:'The Ashen Pilgrim',        sub:'A long walk. The wrong shrine.',                  tags:['Wide-brim hat','Travel coat','Lantern staff'],  stats:{ATK:2,DEF:3,DEX:5,TORCH:8}, spell:{name:'Sanctuary',       cd:8, ar:3,      color:'#d4be7a', desc:'Heal and reveal nearby ground.'} },
  warden:     { name:'The Tower Warden',         sub:'They built the gate. He stayed when it failed.',  tags:['Tower shield','Heavy plate','Unbroken'],        stats:{ATK:3,DEF:7,DEX:1,TORCH:4}, spell:{name:'Iron Stand',      cd:8,            color:'#bcd6ff', desc:'Iron Skin & brace; attackers slowed.'} },
  bladedancer:{ name:'The Blade Dancer',         sub:'She named both knives. She won’t say which.', tags:['Twin daggers','Crimson sash','Crit strikes'],  stats:{ATK:5,DEF:2,DEX:6,TORCH:5}, spell:{name:'Echo Strike',     cd:5, rng:2,      color:'#ff8844', desc:'Strike the nearest enemy three times.'} },
  echobinder: { name:'The Echobinder',           sub:'She heard the depths first. Then she answered.',  tags:['Voidchoir robe','Sonic spell','Glass cannon'],  stats:{ATK:4,DEF:1,DEX:3,TORCH:6}, spell:{name:'Sundering Chord', cd:9, rng:7, ar:1, color:'#c060ff', desc:'Sonic burst — damage + freeze.'} },
};
const HERO_ART_ORDER = ['vigil','hollow','inquisitor','reaver','pilgrim','warden','bladedancer','echobinder'];

// ═══════════════════════════════════════════════════════════════════════
// SVG builder + canvas rasteriser
// ═══════════════════════════════════════════════════════════════════════
export function heroArtSVG(kind, px = 256) {
  const render = HERO_ART[kind] || HERO_ART.vigil;
  const p = HPAL[kind] || HPAL.vigil;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" `
    + `width="${px}" height="${px}" style="overflow:visible">${render(p)}</svg>`;
}

export function hasHeroArt(kind) { return !!HERO_ART[kind]; }

export function preloadHeroArt() {
  for (const kind of HERO_ART_ORDER) rasterPreload('hero:' + kind, () => heroArtSVG(kind, 256));
}

/** Draw hero `kind` into (x,y) at size×size. Returns false until decoded. */
export function drawVectorHero(ctx, x, y, size, kind) {
  if (!HERO_ART[kind]) return false;
  return rasterDraw(ctx, x, y, size, 'hero:' + kind, () => heroArtSVG(kind, 256));
}

export { HPAL, HERO_ART, HERO_INFO, HERO_ART_ORDER };

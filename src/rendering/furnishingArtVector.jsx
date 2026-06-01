// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Dungeon Furnishing Vector Art
//  SVG/JSX pipeline for Claude furnishing handoff: fixtures + decor.
// ═══════════════════════════════════════════════════════════════════════
import { h, Fragment } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const INK = '#08070c';
const ol = (c = INK, w = 0.6) => ({ stroke: c, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round' });
const gl = (col, r = 2) => ({ filter: `drop-shadow(0 0 ${r}px ${col})` });
const hex = (c) => {
  c = String(c || '#000000').replace('#', '');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
};
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  const m = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
};

function palette(def = {}) {
  const stone = def.wallPalette || ['#4a4452', '#211d27'];
  const floor = def.floorPalette || ['#2a2630', '#15131a'];
  const cap = stone[0] || '#9a8c98';
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
    floor,
    cap,
    ambient: ambientByBiome[def.biomeId] || '#4a7eb8',
    torch: def.biomeId === 'frozen_halls' ? '#bfd6ff'
      : def.biomeId === 'void_sanctum' ? '#c08aff'
      : def.biomeId === 'magma_foundry' ? '#ffa040'
      : '#d4ac6c'
  };
}

const Flame = (cx, top, w, tint) => (
  <g>
    <path d={`M${cx} ${top} Q${cx - w} ${top + w * 1.4} ${cx - w * 0.5} ${top + w * 2.2} Q${cx - w} ${top + w * 1.8} ${cx} ${top + w * 2.6} Q${cx + w} ${top + w * 1.8} ${cx + w * 0.5} ${top + w * 2.2} Q${cx + w} ${top + w * 1.4} ${cx} ${top} Z`} fill={tint} style={gl(tint, 2.5)} />
    <path d={`M${cx} ${top + w * 0.7} Q${cx - w * 0.5} ${top + w * 1.6} ${cx} ${top + w * 2.3} Q${cx + w * 0.5} ${top + w * 1.6} ${cx} ${top + w * 0.7} Z`} fill="#fff7e0" opacity="0.85" />
  </g>
);

function StairDown(b) {
  const [sl, sd] = b.stone;
  const treads = [{ y: 7, w: 22 }, { y: 11.4, w: 18 }, { y: 15.8, w: 14 }, { y: 20.2, w: 10.5 }];
  return (<>
    <path d="M2 5 L9 5 L8 28 L3 28 Z" fill={sd} {...ol()} />
    <path d="M30 5 L23 5 L24 28 L29 28 Z" fill={sd} {...ol()} />
    <path d="M2 5 L9 5 L8.6 8 L2.4 8 Z" fill={mix(sl, sd, 0.2)} />
    <path d="M30 5 L23 5 L23.4 8 L29.6 8 Z" fill={mix(sl, sd, 0.2)} />
    {treads.map((tr, i) => {
      const tt = i / (treads.length - 1);
      const face = mix(sl, sd, 0.2 + tt * 0.6);
      return <g key={i}>
        <rect x={16 - tr.w / 2} y={tr.y} width={tr.w} height="3.6" fill={face} {...ol(INK, 0.5)} />
        <rect x={16 - tr.w / 2} y={tr.y} width={tr.w} height="1" fill={mix(b.cap, face, 0.5)} />
        <rect x={16 - tr.w / 2} y={tr.y + 3.4} width={tr.w} height="0.6" fill={mix(face, '#000000', 0.5)} />
      </g>;
    })}
    <rect x="11" y="23.6" width="10" height="6" fill={b.ambient} {...ol(INK, 0.5)} />
    <rect x="12.2" y="24.6" width="7.6" height="4.4" fill={mix(b.ambient, '#000000', 0.5)} />
    <rect x="13.4" y="25.6" width="5.2" height="3" fill="#000" />
    <rect x="11" y="22" width="10" height="8" fill={b.ambient} opacity="0.18" style={gl(b.ambient, 3)} />
    <g fill={b.cap}><rect x="14.4" y="4.4" width="3.2" height="1.4" /><rect x="15.2" y="5.6" width="1.6" height="1.4" /><rect x="14.6" y="4.5" width="2.8" height="0.5" fill="#fff" opacity="0.5" /></g>
    {[5.2, 26.8].map((tx) => <g key={tx}>
      <rect x={tx} y="11" width="1.4" height="7" fill="#3a2a18" {...ol(INK, 0.4)} />
      <path d={`M${tx + 0.7} 11 Q${tx - 1} 8 ${tx + 0.7} 6 Q${tx + 2.4} 8 ${tx + 0.7} 11 Z`} fill={b.torch} style={gl(b.torch, 2)} />
      <ellipse cx={tx + 0.7} cy="8.4" rx="0.7" ry="1.2" fill="#fff3d0" />
    </g>)}
  </>);
}

function Forge(b) {
  const ember = '#ff7a2a', emberHi = '#ffd86a';
  return (<>
    <path d="M4 21 L28 21 L26 30 L6 30 Z" fill={mix(b.stone[0], b.stone[1], 0.35)} {...ol()} />
    <path d="M4 21 L28 21 L27.4 22.6 L4.6 22.6 Z" fill={b.cap} opacity="0.5" />
    <path d="M4 21 L16 21 L15.4 30 L6 30 Z" fill="#000" opacity="0.18" />
    <rect x="7" y="23" width="18" height="4.5" fill="#2a0e06" />
    {[8, 11, 14, 17, 20, 22.5].map((cx, i) => <circle key={i} cx={cx} cy="25.2" r={0.9 + (i % 2) * 0.5} fill={i % 2 ? emberHi : ember} style={gl(ember, 2)} />)}
    <rect x="12" y="17" width="8" height="2.6" fill="#2a2a32" {...ol()} />
    <path d="M7.5 11.5 L23 11.5 L21.5 14.2 L20.5 14.2 L20 17 L12 17 L11.5 14.2 L10.5 14.2 Z" fill="#4a4a54" {...ol()} />
    <path d="M7.5 11.5 L23 11.5 L22.4 12.6 L8.1 12.6 Z" fill="#6e6e7a" />
    <path d="M7.5 11.5 L4.2 10.2 L7.6 9.6 L8.4 11.5 Z" fill="#3a3a44" {...ol()} />
    <ellipse cx="13" cy="12" rx="2.4" ry="0.8" fill="#fff" opacity="0.12" />
    <rect x="14" y="10.4" width="4" height="1.4" fill={emberHi} style={gl(ember, 2)} />
    <rect x="22.4" y="13" width="1.4" height="9" fill="#3a2818" {...ol(INK, 0.4)} transform="rotate(12 23 18)" />
    <rect x="21" y="11.6" width="5" height="3" fill="#52525c" {...ol()} transform="rotate(12 23.5 13)" />
    <rect x="21.4" y="12" width="4.2" height="0.8" fill="#8a8a96" transform="rotate(12 23.5 13)" />
    <ellipse cx="16" cy="22" rx="13" ry="9" fill={ember} opacity="0.14" style={gl(ember, 3)} />
  </>);
}

function Shrine(b) {
  const [sl, sd] = b.stone;
  const stoneMid = mix(sl, sd, 0.3);
  return (<>
    <rect x="6" y="25" width="20" height="4" fill={sd} {...ol()} />
    <rect x="6" y="25" width="20" height="1" fill={mix(sl, sd, 0.5)} />
    <rect x="8.5" y="21.5" width="15" height="3.8" fill={stoneMid} {...ol()} />
    <rect x="8.5" y="21.5" width="15" height="0.9" fill={mix(sl, sd, 0.6)} />
    <path d="M11 21.5 L11 9 L16 4 L21 9 L21 21.5 Z" fill={stoneMid} {...ol()} />
    <path d="M11 21.5 L11 9 L16 4 L16 21.5 Z" fill="#000" opacity="0.16" />
    <path d="M16 4 L21 9 L20.2 9.4 L16 5.2 Z" fill={mix(sl, sd, 0.55)} />
    <g stroke={mix(b.ambient, sd, 0.3)} strokeWidth="0.5" opacity="0.7"><line x1="13.5" y1="14" x2="18.5" y2="14" /><line x1="14.5" y1="16" x2="17.5" y2="16" /><line x1="13.5" y1="18" x2="18.5" y2="18" /></g>
    <ellipse cx="16" cy="10.5" rx="2.6" ry="3" fill="#000" />
    <ellipse cx="16" cy="10.5" rx="1.7" ry="2.1" fill={b.ambient} style={gl(b.ambient, 3)} />
    <ellipse cx="15.4" cy="9.6" rx="0.5" ry="0.7" fill="#fff" opacity="0.8" />
    <circle cx="16" cy="10.5" r="6.5" fill={b.ambient} opacity="0.12" style={gl(b.ambient, 3)} />
    {[10.5, 21.5].map((bx) => <g key={bx}><path d={`M${bx - 1.6} 20 L${bx + 1.6} 20 L${bx + 1} 21.4 L${bx - 1} 21.4 Z`} fill={sd} {...ol(INK, 0.4)} /><ellipse cx={bx} cy="20" rx="1.6" ry="0.5" fill={b.torch} opacity="0.9" style={gl(b.ambient, 1.5)} /></g>)}
  </>);
}

const DECOR = {
  wall_torch: (b) => (<>
    <path d="M13 16 L19 16 L18 20 L14 20 Z" fill="#3a3a44" {...ol()} />
    <rect x="12.5" y="15.4" width="7" height="1.4" fill="#52525c" {...ol(INK, 0.4)} />
    <rect x="15" y="11" width="2" height="6" fill="#2a1c10" {...ol(INK, 0.4)} />
    <path d="M11 20 Q16 17 21 20 L20 27 L12 27 Z" fill="#1a1620" opacity="0.55" />
    {Flame(16, 4, 2.4, b.torch)}
    <ellipse cx="16" cy="9" rx="7" ry="8" fill={b.torch} opacity="0.12" style={gl(b.torch, 3)} />
  </>),
  brazier: (b) => (<>
    <ellipse cx="16" cy="29" rx="9" ry="2.2" fill="#000" opacity="0.3" />
    <path d="M11 20 L8 29 M21 20 L24 29 M16 21 L16 29" stroke="#2a2a32" strokeWidth="1.6" {...ol()} fill="none" />
    <path d="M8 17 L24 17 L21.5 22 L10.5 22 Z" fill="#3a3a44" {...ol()} />
    <path d="M8 17 L24 17 L23.4 18.2 L8.6 18.2 Z" fill="#5a5a66" />
    <ellipse cx="16" cy="17" rx="8" ry="2" fill="#1a1018" {...ol(INK, 0.5)} />
    {[12, 14.5, 17, 19.5].map((cx, i) => <circle key={i} cx={cx} cy="16.6" r="0.9" fill={i % 2 ? '#ffd86a' : '#ff7a2a'} style={gl('#ff7a2a', 2)} />)}
    {Flame(16, 6, 3, b.torch)}
  </>),
  banner: (b) => {
    const cloth = mix(b.ambient, b.stone[1], 0.45);
    return <><rect x="6" y="4" width="20" height="1.8" fill="#2a2a32" {...ol(INK, 0.4)} /><circle cx="6.4" cy="4.9" r="1.3" fill="#52525c" {...ol(INK, 0.4)} /><circle cx="25.6" cy="4.9" r="1.3" fill="#52525c" {...ol(INK, 0.4)} /><path d="M8.5 5.6 L23.5 5.6 L23.5 24 L19.6 27 L16 24.5 L12.4 27 L8.5 24 Z" fill={cloth} {...ol()} /><path d="M8.5 5.6 L13 5.6 L13 25.5 L12.4 27 L8.5 24 Z" fill="#000" opacity="0.18" /><rect x="8.5" y="5.6" width="0.9" height="19" fill={b.cap} opacity="0.6" /><rect x="22.6" y="5.6" width="0.9" height="19" fill={b.cap} opacity="0.6" /><g fill={b.cap} opacity="0.92" style={gl(b.ambient, 1.5)}><path d="M16 9 L20 13 L18.4 13 L16 11 L13.6 13 L12 13 Z" /><path d="M16 14 L20 18 L18.4 18 L16 16 L13.6 18 L12 18 Z" /><circle cx="16" cy="21" r="1.4" /></g></>;
  },
  bone_pile: () => (<>
    <ellipse cx="16" cy="27.5" rx="11" ry="2.6" fill="#000" opacity="0.3" />
    <rect x="5" y="24" width="14" height="2.2" rx="1.1" fill="#9c8c68" transform="rotate(-12 12 25)" {...ol(INK, 0.5)} />
    <rect x="12" y="23.5" width="15" height="2.2" rx="1.1" fill="#c4b78e" transform="rotate(14 19 24.5)" {...ol(INK, 0.5)} />
    <path d="M11 14 Q11 8 16 8 Q21 8 21 14 Q21 17 19 18 L19 21 L13 21 L13 18 Q11 17 11 14 Z" fill="#c4b78e" {...ol()} />
    <ellipse cx="13.6" cy="14" rx="1.7" ry="2" fill={INK} /><ellipse cx="18.4" cy="14" rx="1.7" ry="2" fill={INK} /><path d="M15.2 16.5 L16 18 L16.8 16.5 Z" fill={INK} />
  </>),
  broken_pillar: (b) => {
    const mid = mix(b.stone[0], b.stone[1], 0.35);
    return <><ellipse cx="16" cy="29" rx="9" ry="2.4" fill="#000" opacity="0.32" /><rect x="8" y="25" width="16" height="4" fill={b.stone[1]} {...ol()} /><rect x="9.5" y="22.5" width="13" height="2.6" fill={mid} {...ol()} /><path d="M11 22.5 L11 11 L13 8 L19 8 L21 11 L21 22.5 Z" fill={mid} {...ol()} /><path d="M11 22.5 L11 11 L13 8 L15 8 L15 22.5 Z" fill="#000" opacity="0.16" /><path d="M13 8 L14.5 5 L16 7.5 L18 4.5 L19 8 Z" fill={mid} {...ol()} /><path d="M22 26 L27 25 L27.5 28 L22.5 29 Z" fill={mid} {...ol()} /><path d="M16 12 L14.5 15 L16 18 L15 21" stroke={INK} strokeWidth="0.5" fill="none" opacity="0.6" /></>;
  },
  wall_chains: () => (<>
    {[10, 22].map((px) => <g key={px}><rect x={px - 2.5} y="6" width="5" height="5" rx="0.8" fill="#34303e" {...ol(INK, 0.5)} /><circle cx={px} cy="8.5" r="1.4" fill="#5a5466" /></g>)}
    {[11, 17, 23, 27].map((yy, i) => <ellipse key={i} cx={10 + (i === 1 ? 0.5 : 0)} cy={yy} rx="1.4" ry="2.6" fill="none" stroke="#5a5466" strokeWidth="1.1" />)}
    {[11, 16, 21, 26].map((yy, i) => <ellipse key={i} cx={22 + (i % 2 ? 0.6 : 0)} cy={yy} rx="1.3" ry="2.4" fill="none" stroke="#5a5466" strokeWidth="1.1" />)}
  </>),
  gargoyle: (b) => {
    const mid = mix(b.stone[0], b.stone[1], 0.4);
    return <><path d="M9 24 L23 24 L20 30 L12 30 Z" fill={b.stone[1]} {...ol()} /><path d="M9 11 Q9 6 16 6 Q23 6 23 11 L23 20 Q23 24 16 24 Q9 24 9 20 Z" fill={mid} {...ol()} /><path d="M10 8 Q7 3 11 7 Z" fill={mid} {...ol()} /><path d="M22 8 Q25 3 21 7 Z" fill={mid} {...ol()} /><path d="M11 13 L15 12 M21 13 L17 12" stroke={INK} strokeWidth="0.9" fill="none" /><ellipse cx="13" cy="14.5" rx="1.6" ry="1.3" fill={INK} /><ellipse cx="19" cy="14.5" rx="1.6" ry="1.3" fill={INK} /><circle cx="13" cy="14.4" r="0.8" fill={b.ambient} style={gl(b.ambient, 2)} /><circle cx="19" cy="14.4" r="0.8" fill={b.ambient} style={gl(b.ambient, 2)} /><path d="M12 18 Q16 21 20 18 L20 19.5 Q16 22.5 12 19.5 Z" fill={INK} /></>;
  },
  cobweb: () => (<>
    <g stroke="#8a8494" strokeWidth="0.5" fill="none" opacity="0.55">{[[30, 4], [30, 12], [26, 20], [18, 26], [8, 30]].map(([x, y], i) => <line key={i} x1="2" y1="2" x2={x} y2={y} />)}<path d="M9 2 Q9 9 2 9" /><path d="M16 2 Q16 16 2 16" /><path d="M24 3 Q24 24 3 24" /><path d="M30 5 Q30 30 5 30" /></g>
    {[[12, 10], [18, 15], [9, 18], [22, 13]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.5" fill="#cfc8d8" opacity="0.8" />)}
    <ellipse cx="20" cy="20" rx="1.4" ry="1.1" fill="#1a1620" {...ol(INK, 0.3)} />
  </>),
  rune_crack: (b) => (<>
    <rect x="3" y="3" width="26" height="26" fill={mix(b.stone[0], b.stone[1], 0.25)} opacity="0.25" />
    <path d="M16 2 L14 8 L17 12 L13 17 L16 22 L14 30" stroke={INK} strokeWidth="2.2" fill="none" strokeLinejoin="round" />
    <path d="M16 2 L14 8 L17 12 L13 17 L16 22 L14 30" stroke={b.ambient} strokeWidth="0.9" fill="none" strokeLinejoin="round" style={gl(b.ambient, 2.5)} />
    <path d="M14 8 L9 6 M17 12 L22 11 M13 17 L8 19 M16 22 L21 24" stroke={INK} strokeWidth="1" fill="none" />
  </>)
};

const FIXTURE = { stair_down: StairDown, forge: Forge, shrine: Shrine };
const MARGIN = 4;
const VB = 32 + MARGIN * 2;
const OVERSCAN = MARGIN / 32;

function svgShell(body, px) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-MARGIN} ${-MARGIN} ${VB} ${VB}" width="${px}" height="${px}" style="overflow:visible">${body}</svg>`;
}

export function fixtureSVG(kind, def, px = 256) {
  const b = palette(def);
  const fn = FIXTURE[kind] || StairDown;
  return svgShell(`<ellipse cx="16" cy="29.5" rx="11" ry="2.4" fill="#000" opacity="0.35"/>${fn(b)}`, px);
}

export function decorSVG(kind, def, px = 256) {
  const b = palette(def);
  const fn = DECOR[kind] || DECOR.wall_torch;
  return svgShell(fn(b), px);
}

const keyFor = (prefix, kind, def) => `${prefix}:${kind}:${def?.biomeId || 'default'}:${(def?.wallPalette || []).join(',')}:${(def?.floorPalette || []).join(',')}`;

export function drawVectorFixture(ctx, x, y, size, kind, def) {
  const key = keyFor('fixture', kind, def);
  return rasterDraw(ctx, x, y, size, key, () => fixtureSVG(kind, def, 256), OVERSCAN);
}

export function drawVectorDecor(ctx, x, y, size, kind, def) {
  const key = keyFor('decor', kind, def);
  return rasterDraw(ctx, x, y, size, key, () => decorSVG(kind, def, 256), OVERSCAN);
}

export function preloadFurnishingArt() {
  for (const kind of Object.keys(FIXTURE)) rasterPreload('fixture:' + kind, () => fixtureSVG(kind, {}, 256));
  for (const kind of Object.keys(DECOR)) rasterPreload('decor:' + kind, () => decorSVG(kind, {}, 256));
}

export const WALL_DECOR_KINDS = ['wall_torch', 'banner', 'wall_chains', 'cobweb', 'rune_crack'];
export const FLOOR_DECOR_KINDS = ['brazier', 'bone_pile', 'broken_pillar'];

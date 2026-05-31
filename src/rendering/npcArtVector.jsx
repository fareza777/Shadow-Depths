// ═══════════════════════════════════════════════════════════════════════
//  Shadow Depths · Dungeon NPC Vector Art
//  Direct SVG/JSX port of the Claude handoff for friendly NPCs.
// ═══════════════════════════════════════════════════════════════════════
import { h, Fragment } from './svgHyperscript.js';
import { rasterDraw, rasterPreload } from './spriteRaster.js';

const NINK = '#08070c';
const nol = (c = NINK, w = 0.6) => ({ stroke: c, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round' });
const ngl = (col, r = 2) => ({ filter: `drop-shadow(0 0 ${r}px ${col})` });
const NPupil = (cx, cy, r, col, k) => (
  <g key={k}>
    <circle cx={cx} cy={cy} r={r} fill={col} style={ngl(col, 1.6)} />
    <circle cx={cx} cy={cy} r={r * 0.4} fill="#fff" opacity="0.85" />
  </g>
);

function Merchant() {
  const robe = '#5a3d24', robeLo = '#3c2817', robeHi = '#7a5836', gilt = '#d4ac6c', giltLo = '#9a7838';
  return (<>
    <g {...nol(NINK, 0.5)}>
      <rect x="2.5" y="18" width="7" height="7" fill="#4a3320" />
      <rect x="2.5" y="18" width="7" height="1" fill="#6a4a30" />
      <path d="M2.5 18 L9.5 25 M9.5 18 L2.5 25" stroke="#2a1c10" strokeWidth="0.5" />
    </g>
    {[0, 1, 2].map((i) => <ellipse key={i} cx="6" cy={17.4 - i * 1.1} rx="2.4" ry="0.9" fill={i % 2 ? gilt : giltLo} {...nol(NINK, 0.3)} />)}

    <path d="M11.5 13 L21 13 L24 30 L9 30 Z" fill={robe} {...nol()} />
    <path d="M11.5 13 L16 13 L16 30 L9 30 Z" fill={robeLo} opacity="0.55" />
    <path d="M18.5 14 L20.5 29" stroke={robeHi} strokeWidth="0.5" opacity="0.4" />
    <rect x="9" y="28.2" width="15" height="1.6" fill={gilt} opacity="0.9" />
    <rect x="10.5" y="20" width="11" height="1.8" fill={giltLo} {...nol(NINK, 0.4)} />
    <circle cx="16" cy="20.9" r="0.9" fill={gilt} />
    <path d="M8.5 18 L13 18 L12.5 23 L9 23 Z" fill="#3a2614" {...nol(NINK, 0.5)} />
    <rect x="8.5" y="18" width="4.5" height="1.4" fill={gilt} opacity="0.85" />
    <path d="M9.5 19.5 Q10.7 22 11.8 19.5" fill="none" stroke={giltLo} strokeWidth="0.4" />
    <path d="M11.5 14 L8 20 L10.5 21 L13 16 Z" fill={robe} {...nol()} />
    <path d="M21 14 L24.5 20 L22 21 L19 16 Z" fill={robe} {...nol()} />
    <ellipse cx="9.2" cy="20.5" rx="1.4" ry="1.2" fill="#caa066" {...nol(NINK, 0.4)} />

    <path d="M16 3 Q23 6 21.5 15 L10.5 15 Q9 6 16 3 Z" fill={robeLo} {...nol()} />
    <path d="M16 3 Q23 6 21.5 15 L16 15 Z" fill="#000" opacity="0.12" />
    <path d="M11 8 Q16 5 21 8" stroke={robeHi} strokeWidth="0.5" fill="none" opacity="0.4" />
    <path d="M13 8.5 Q16 7 19 8.5 L18.5 12.5 Q16 14 13.5 12.5 Z" fill="#140d08" />
    {NPupil(14.6, 10.6, 1, '#ffd070', 'a')}{NPupil(17.4, 10.6, 1, '#ffd070', 'b')}

    <g style={ngl('#ffcc55', 2)}>
      <circle cx="25" cy="9" r="2.6" fill="#ffd86a" {...nol(NINK, 0.4)} />
      <circle cx="25" cy="9" r="1.8" fill="none" stroke="#a8791f" strokeWidth="0.5" />
      <text x="25" y="9.1" textAnchor="middle" dominantBaseline="central" fontSize="3" fontFamily="serif" fontWeight="700" fill="#8a5e12">$</text>
    </g>
  </>);
}

function Keeper() {
  const robe = '#36506a', robeLo = '#243a50', robeHi = '#4e7090', skin = '#caa884', soul = '#7fe8ff', gilt = '#d4be7a';
  return (<>
    <rect x="6.8" y="6" width="1.5" height="22" fill="#3a2818" {...nol(NINK, 0.4)} />
    <g>
      <path d="M5.4 6 L8.6 6 L8.6 4.6 L5.4 4.6 Z" fill="#2a2a32" {...nol(NINK, 0.4)} />
      <rect x="4.8" y="6" width="4.4" height="6" rx="0.6" fill="#2a2a32" {...nol(NINK, 0.5)} />
      <rect x="5.6" y="6.8" width="2.8" height="4.4" fill={soul} style={ngl(soul, 3)} />
      <rect x="6.4" y="7.4" width="1.2" height="3.2" fill="#eafcff" />
      <rect x="4.8" y="11.6" width="4.4" height="1" fill="#3a3a44" />
      <circle cx="7" cy="9" r="6" fill={soul} opacity="0.12" style={ngl(soul, 3)} />
    </g>

    <path d="M11.5 14 L20.5 14 L23 30 L9.5 30 Z" fill={robe} {...nol()} />
    <path d="M11.5 14 L16 14 L16 30 L9.5 30 Z" fill={robeLo} opacity="0.5" />
    <path d="M18 15 L20 29" stroke={robeHi} strokeWidth="0.5" opacity="0.4" />
    <path d="M10.5 14 Q16 11.5 21.5 14 L20 18 Q16 16 12 18 Z" fill={robeHi} {...nol()} />
    <rect x="10" y="27.4" width="13.5" height="1.6" fill={gilt} opacity="0.6" />
    <path d="M11 16 L21 19" stroke={gilt} strokeWidth="1.2" opacity="0.8" />

    <path d="M11.5 15 L7.8 9 L9.6 8 L13 14 Z" fill={robe} {...nol()} />
    <ellipse cx="8.4" cy="8.6" rx="1.4" ry="1.3" fill={skin} {...nol(NINK, 0.4)} />
    <path d="M20.5 15 L24 20 L22 22 L18.5 17 Z" fill={robe} {...nol()} />
    <g {...nol(NINK, 0.4)}>
      <path d="M20 20 L27 19 L27 24 L20 25 Z" fill="#c8bda0" />
      <path d="M23.5 19.4 L23.5 24.4" stroke="#9a8e6c" strokeWidth="0.5" />
      <path d="M21 21 L26 20.3 M21 22.2 L26 21.5 M21 23.4 L26 22.7" stroke="#7a6e54" strokeWidth="0.3" />
    </g>

    <ellipse cx="16" cy="9.5" rx="4.4" ry="4.8" fill={skin} {...nol()} />
    <path d="M11.5 9 Q11 4 16 4 Q21 4 20.5 9 Q18 6.5 16 6.8 Q14 6.5 11.5 9 Z" fill="#8a8e98" {...nol(NINK, 0.5)} />
    <path d="M11 11 Q9.5 15 12 16 L12 13 Z" fill={robeLo} {...nol(NINK, 0.5)} />
    <path d="M21 11 Q22.5 15 20 16 L20 13 Z" fill={robeLo} {...nol(NINK, 0.5)} />
    {NPupil(14.3, 9.4, 0.85, '#3a2a4a', 'e1')}{NPupil(17.7, 9.4, 0.85, '#3a2a4a', 'e2')}
    <path d="M12.6 8 Q14.3 7.2 15.6 8" stroke="#6a6056" strokeWidth="0.4" fill="none" />
    <path d="M16.4 8 Q17.7 7.2 19.4 8" stroke="#6a6056" strokeWidth="0.4" fill="none" />
    <path d="M14 12 Q16 13.4 18 12" stroke="#8a5a4a" strokeWidth="0.5" fill="none" />
    <path d="M12.6 11.5 Q16 16.5 19.4 11.5 Q18 14 16 14 Q14 14 12.6 11.5 Z" fill="#9a9ea8" {...nol(NINK, 0.4)} />
    <ellipse cx="13.8" cy="7.2" rx="1.5" ry="1" fill="#fff" opacity="0.2" />

    <circle cx="24" cy="11" r="1" fill={soul} style={ngl(soul, 3)} />
  </>);
}

const NPC_ART = { merchant: Merchant, keeper: Keeper };
const NPC_MARGIN = 4;
const NPC_VB = 32 + NPC_MARGIN * 2;
const NPC_OVERSCAN = NPC_MARGIN / 32;

export function npcArtSVG(kind, px = 256) {
  const render = NPC_ART[kind] || NPC_ART.merchant;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-NPC_MARGIN} ${-NPC_MARGIN} ${NPC_VB} ${NPC_VB}" width="${px}" height="${px}" style="overflow:visible">`
    + `<ellipse cx="16" cy="30.2" rx="9" ry="2" fill="#000" opacity="0.32"/>${render()}</svg>`;
}

export function preloadNpcArt() {
  for (const kind of Object.keys(NPC_ART)) rasterPreload('npc:' + kind, () => npcArtSVG(kind, 256));
}

export function drawVectorNPC(ctx, x, y, size, kind) {
  if (!NPC_ART[kind]) return false;
  return rasterDraw(ctx, x, y, size, 'npc:' + kind, () => npcArtSVG(kind, 256), NPC_OVERSCAN);
}

export { NPC_ART };

/**
 * svgHyperscript.js — minimal JSX → SVG markup-string runtime (no React).
 *
 * esbuild (vite.config.js) is configured with jsxFactory:'h', jsxFragment:
 * 'Fragment', so the hand-built art engines can author sprites as JSX while
 * emitting plain SVG strings that get rasterised onto the game canvas.
 */

export const Fragment = Symbol('Fragment');
export const React = { Fragment };

// camelCase prop → SVG attribute name. Anything not listed passes through
// unchanged (cx, cy, r, d, points, transform, filter, opacity, stdDeviation,
// result, in, x1, y1, rx, dur, values, attributeName, repeatCount, …).
const ATTR_MAP = {
  strokeWidth: 'stroke-width', strokeLinejoin: 'stroke-linejoin',
  strokeLinecap: 'stroke-linecap', strokeDasharray: 'stroke-dasharray',
  strokeMiterlimit: 'stroke-miterlimit', fontSize: 'font-size',
  fillOpacity: 'fill-opacity', strokeOpacity: 'stroke-opacity',
  fillRule: 'fill-rule', clipRule: 'clip-rule', clipPath: 'clip-path',
  stopColor: 'stop-color', stopOpacity: 'stop-opacity',
  shapeRendering: 'shape-rendering', className: 'class',
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

export function h(tag, props, ...children) {
  const inner = children
    .flat(Infinity)
    .filter((c) => c != null && c !== false && c !== true)
    .join('');
  if (tag === Fragment) return inner;
  return `<${tag}${_attrs(props)}>${inner}</${tag}>`;
}

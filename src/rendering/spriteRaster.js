/**
 * spriteRaster.js — shared SVG→canvas rasteriser for the vector sprite
 * engines (heroes, items; the enemy engine predates this and keeps its own).
 *
 * Each vector sprite is built as an SVG markup string, decoded once into an
 * <Image>, and cached. Draws are synchronous: they return false until the
 * image has decoded so callers can fall back to the legacy sprite for those
 * first frames, then true once the raster is ready.
 *
 * The decoded Image is NOT drawn directly every frame: Chromium (and the
 * Android WebView) re-rasterises an SVG-backed image on each drawImage at the
 * requested size, which is the single most expensive per-frame op in the world
 * pass. Instead each sprite is baked once into a bitmap canvas at its on-screen
 * pixel size, and frames blit that bitmap 1:1.
 */
import { Layout } from '../config/layoutMetrics.js';

const _cache = new Map(); // cacheKey → { img, ready, error }
const _baked = new Map(); // `${cacheKey}@${px}` → bitmap canvas
const BAKED_LIMIT = 512;

function _record(cacheKey, buildSVG) {
  let rec = _cache.get(cacheKey);
  if (rec) return rec;
  rec = { img: null, ready: false, error: false };
  _cache.set(cacheKey, rec);
  if (typeof Image === 'undefined') { rec.error = true; return rec; }
  let svg;
  try { svg = buildSVG(); } catch { svg = ''; }
  if (!svg) { rec.error = true; return rec; }
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { rec.img = img; rec.ready = true; };
  img.onerror = () => { rec.error = true; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  rec.img = img;
  return rec;
}

/** Kick off rasterisation without drawing (call at boot to pre-warm). */
export function rasterPreload(cacheKey, buildSVG) {
  _record(cacheKey, buildSVG);
}

/** Backing-store pixel size to bake for a `size` logical-px destination. */
export function bakePx(size) {
  return Math.max(4, Math.round(size * (Layout.dpr || 1)));
}

/**
 * Bake a decoded SVG image into a bitmap canvas at `px`×`px` and cache it.
 * Returns null when no canvas is available (tests / non-DOM) so callers can
 * fall back to drawing the image itself.
 */
export function bakedRaster(img, cacheKey, px) {
  const bakeKey = `${cacheKey}@${px}`;
  const hit = _baked.get(bakeKey);
  if (hit) return hit;
  let cv;
  if (typeof document !== 'undefined') {
    cv = document.createElement('canvas');
    cv.width = px;
    cv.height = px;
  } else if (typeof OffscreenCanvas !== 'undefined') {
    cv = new OffscreenCanvas(px, px);
  } else {
    return null;
  }
  const bctx = cv.getContext('2d');
  if (!bctx) return null;
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(img, 0, 0, px, px);
  if (_baked.size >= BAKED_LIMIT) {
    _baked.delete(_baked.keys().next().value);
  }
  _baked.set(bakeKey, cv);
  return cv;
}

/**
 * Draw the cached raster into (x,y) at size×size. Returns true if drawn, or
 * false if the image isn't decoded yet (or failed) — caller should fall back.
 *
 * `overscan` (fraction of size) lets sprites whose SVG viewBox carries a
 * margin draw slightly larger and offset, so the on-tile core keeps its size
 * while capes / weapons / glows that live in the margin overhang the tile
 * instead of being clipped.
 */
export function rasterDraw(ctx, x, y, size, cacheKey, buildSVG, overscan = 0) {
  const rec = _record(cacheKey, buildSVG);
  if (!rec.ready || !rec.img) return false;
  const o = overscan ? size * overscan : 0;
  const dest = size + 2 * o;
  const baked = bakedRaster(rec.img, cacheKey, bakePx(dest));
  ctx.drawImage(baked || rec.img, x - o, y - o, dest, dest);
  return true;
}

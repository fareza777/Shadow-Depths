/**
 * spriteRaster.js — shared SVG→canvas rasteriser for the vector sprite
 * engines (heroes, items; the enemy engine predates this and keeps its own).
 *
 * Each vector sprite is built as an SVG markup string, decoded once into an
 * <Image>, and cached. Draws are synchronous: they return false until the
 * image has decoded so callers can fall back to the legacy sprite for those
 * first frames, then true once the raster is ready.
 */

const _cache = new Map(); // cacheKey → { img, ready, error }

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
  if (overscan) {
    const o = size * overscan;
    ctx.drawImage(rec.img, x - o, y - o, size + 2 * o, size + 2 * o);
  } else {
    ctx.drawImage(rec.img, x, y, size, size);
  }
  return true;
}

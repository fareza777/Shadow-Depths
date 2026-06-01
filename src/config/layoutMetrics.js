/**
 * Runtime layout metrics — synced from the real canvas + viewport.
 *
 * Module-load constants in constants.js can disagree with the physical screen
 * (e.g. saved "landscape" setting while the phone is held portrait). All
 * in-game HUD / control-band geometry must read from here.
 */
export const Layout = {
  canvasW: 480,
  canvasH: 900,
  portrait: true,
  hud: 118,
  control: 234,
  sideW: 0,
  // Backing-store scale factor (HiDPI). Logical geometry above stays in CSS
  // px; the canvas bitmap is `logical * dpr` so text/sprites/tiles render
  // crisp on retina/phone panels. Capped at 2 to bound fill-rate.
  dpr: 1
};

/**
 * Device pixel ratio for the backing store. Capped at 1.5 (sharp enough on
 * phone panels while keeping fill-rate sane), and tightened to 1.25 on
 * memory-constrained devices — budget GPUs (e.g. Adreno 610) are fill-rate
 * bound, so a full 2x backing store quadruples per-frame pixels and stutters.
 */
export function currentDpr() {
  if (typeof window === 'undefined') return 1;
  const raw = window.devicePixelRatio || 1;
  const android = isAndroidDevice();
  const mobile = isMobileDevice();
  const lowEnd = isLowEndDevice();
  const cap = android ? 1 : lowEnd || mobile ? 1.25 : 1.5;
  return Math.max(1, Math.min(cap, raw));
}

export function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || navigator.maxTouchPoints > 1;
}

export function isLowEndDevice() {
  if (typeof navigator === 'undefined') return false;
  const mem = navigator.deviceMemory || 0;          // GB, coarse (0 if unknown)
  const cores = navigator.hardwareConcurrency || 0;
  return (mem && mem <= 4) || (cores && cores <= 4);
}

export function prefersLeanCombatFx() {
  return isAndroidDevice() || (isMobileDevice() && isLowEndDevice());
}

export function syncLayoutFromWindow(canvas) {
  const vw = window.visualViewport?.width || window.innerWidth || 480;
  const vh = window.visualViewport?.height || window.innerHeight || 800;
  const portrait = vh >= vw;

  if (portrait) {
    Layout.canvasW = 480;
    Layout.canvasH = Math.max(760, Math.min(1100, Math.round(vh * (480 / vw))));
    Layout.hud = 128;
    Layout.control = Math.max(270, Math.round(Layout.canvasH * 0.29));
    Layout.sideW = 0;
    Layout.portrait = true;
  } else {
    Layout.canvasW = 800;
    Layout.canvasH = 480;
    Layout.hud = 114;
    Layout.control = 0;
    Layout.sideW = 136;
    Layout.portrait = false;
  }

  if (canvas) {
    const dpr = currentDpr();
    Layout.dpr = dpr;
    // Backing store in device px; the Renderer pre-scales the context by dpr
    // so all draws keep using logical (CSS px) coordinates unchanged.
    canvas.width = Math.round(Layout.canvasW * dpr);
    canvas.height = Math.round(Layout.canvasH * dpr);
  }
  return Layout;
}

export function viewportX() { return Layout.sideW; }
export function viewportY() { return Layout.hud; }
export function viewportW() { return Layout.canvasW - Layout.sideW * 2; }
export function viewportH() { return Layout.canvasH - Layout.hud - Layout.control; }
export function viewportBottomY() { return Layout.canvasH - Layout.control; }

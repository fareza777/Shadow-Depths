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
  hud: 112,
  control: 234,
  sideW: 0
};

export function syncLayoutFromWindow(canvas) {
  const vw = window.visualViewport?.width || window.innerWidth || 480;
  const vh = window.visualViewport?.height || window.innerHeight || 800;
  const portrait = vh >= vw;

  if (portrait) {
    Layout.canvasW = 480;
    Layout.canvasH = Math.max(760, Math.min(1100, Math.round(vh * (480 / vw))));
    Layout.hud = 112;
    Layout.control = Math.max(270, Math.round(Layout.canvasH * 0.29));
    Layout.sideW = 0;
    Layout.portrait = true;
  } else {
    Layout.canvasW = 800;
    Layout.canvasH = 480;
    Layout.hud = 108;
    Layout.control = 0;
    Layout.sideW = 136;
    Layout.portrait = false;
  }

  if (canvas) {
    canvas.width = Layout.canvasW;
    canvas.height = Layout.canvasH;
  }
  return Layout;
}

export function viewportX() { return Layout.sideW; }
export function viewportY() { return Layout.hud; }
export function viewportW() { return Layout.canvasW - Layout.sideW * 2; }
export function viewportH() { return Layout.canvasH - Layout.hud - Layout.control; }
export function viewportBottomY() { return Layout.canvasH - Layout.control; }

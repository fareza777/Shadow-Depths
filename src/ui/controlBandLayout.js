/**
 * Control-band geometry — quick-use + D-pad live inside the control band
 * (never overlapping the dungeon viewport).
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, CONTROL_HEIGHT,
  SIDE_CONTROL_WIDTH, IS_LANDSCAPE
} from '../config/constants.js';

export const QUICK_SLOT_COUNT = 3;
export const QUICK_ACTIONS = [
  { type: 'vigil', label: 'HERO' },
  { type: 'inventory', label: 'BAG' },
  { type: 'pickup', label: 'PICK' }
];

/** Bottom edge of the world viewport (pixels). Taps below this are UI-only. */
export const VIEWPORT_BOTTOM_Y = CANVAS_HEIGHT - CONTROL_HEIGHT;

function portraitBandMetrics() {
  const bandY = VIEWPORT_BOTTOM_Y;
  const quickSlot = 44;
  const quickGap = 4;
  const quickY = bandY + 6;
  const quickRowH = quickSlot + 12;
  const dpadBtn = 50;
  const dpadGap = 4;
  const dpadSize = dpadBtn * 3 + dpadGap * 2;
  const dpadX = 10;
  const dpadY = quickY + quickRowH + 8;
  return {
    bandY, quickSlot, quickGap, quickY, quickRowH,
    dpadBtn, dpadGap, dpadSize, dpadX, dpadY
  };
}

/** D-pad — portrait: below quick-use row inside the control band. */
export function getDpadLayout() {
  if (IS_LANDSCAPE) {
    const stripW = SIDE_CONTROL_WIDTH;
    const dpadBtn = 42;
    const dpadGap = 5;
    const dpadSize = dpadBtn * 3 + dpadGap * 2;
    return {
      isLandscape: true,
      stripW,
      dpadBtn,
      dpadGap,
      dpadSize,
      dpadX: (stripW - dpadSize) / 2,
      dpadY: HUD_HEIGHT + 10
    };
  }
  const m = portraitBandMetrics();
  return {
    isLandscape: false,
    bandY: m.bandY,
    dpadBtn: m.dpadBtn,
    dpadGap: m.dpadGap,
    dpadSize: m.dpadSize,
    dpadX: m.dpadX,
    dpadY: m.dpadY
  };
}

/** Quick-use + action chips — portrait: top of control band (y >= VIEWPORT_BOTTOM_Y). */
export function getQuickUseLayout() {
  const dpad = getDpadLayout();
  const quickSlot = IS_LANDSCAPE ? 40 : portraitBandMetrics().quickSlot;
  const quickGap = IS_LANDSCAPE ? 6 : portraitBandMetrics().quickGap;
  const quickRowW = QUICK_SLOT_COUNT * quickSlot + (QUICK_SLOT_COUNT - 1) * quickGap;

  if (IS_LANDSCAPE) {
    const quickX = (dpad.stripW - quickRowW) / 2;
    const quickY = dpad.dpadY - quickSlot - 12;
    return {
      quickSlot,
      quickGap,
      quickX,
      quickY,
      quickRowW,
      quickRects: quickRects(quickX, quickY, quickSlot, quickGap),
      actionRects: []
    };
  }

  const m = portraitBandMetrics();
  const quickX = m.dpadX + (m.dpadSize - quickRowW) / 2;
  const quickY = m.quickY;
  const actionGap = quickGap;
  const actionX = quickX + quickRowW + actionGap;
  const actionW = Math.max(44, Math.floor((CANVAS_WIDTH - actionX - 10 - actionGap * 2) / 3));

  return {
    quickSlot,
    quickGap,
    quickX,
    quickY,
    quickRowW,
    bandTop: m.bandY,
    quickRects: quickRects(quickX, quickY, quickSlot, quickGap),
    actionRects: quickActionRects(actionX, quickY, actionW, quickSlot, actionGap)
  };
}

function quickRects(x, y, slot, gap) {
  return Array.from({ length: QUICK_SLOT_COUNT }, (_, i) => ({
    x: x + i * (slot + gap),
    y,
    w: slot,
    h: slot
  }));
}

function quickActionRects(x, y, w, h, gap) {
  return QUICK_ACTIONS.map((action, i) => ({
    ...action,
    x: x + i * (w + gap),
    y,
    w,
    h
  }));
}

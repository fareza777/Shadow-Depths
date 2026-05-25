/**
 * Shared control-band geometry — D-pad + quick-use row stay aligned.
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, CONTROL_HEIGHT,
  SIDE_CONTROL_WIDTH, IS_LANDSCAPE
} from '../config/constants.js';

export const QUICK_SLOT_COUNT = 3;

/** @returns {object} layout used by MobileControls + QuickUseBar */
export function getControlBandLayout() {
  if (IS_LANDSCAPE) {
    const stripW = SIDE_CONTROL_WIDTH;
    const quickSlot = 40;
    const quickGap = 5;
    const quickRowW = QUICK_SLOT_COUNT * quickSlot + (QUICK_SLOT_COUNT - 1) * quickGap;
    const dpadBtn = 42;
    const dpadGap = 5;
    const dpadSize = dpadBtn * 3 + dpadGap * 2;
    const dpadX = (stripW - dpadSize) / 2;
    const quickX = (stripW - quickRowW) / 2;
    const quickY = HUD_HEIGHT + 8;
    const dpadY = quickY + quickSlot + 8;
    return {
      isLandscape: true,
      stripW,
      dpadBtn, dpadGap, dpadSize, dpadX, dpadY,
      quickSlot, quickGap, quickX, quickY,
      quickRects: quickRects(quickX, quickY, quickSlot, quickGap)
    };
  }

  const bandY = CANVAS_HEIGHT - CONTROL_HEIGHT;
  const quickSlot = 40;
  const quickGap = 5;
  const dpadBtn = 52;
  const dpadGap = 5;
  const dpadSize = dpadBtn * 3 + dpadGap * 2;
  const dpadX = 10;
  const quickRowW = QUICK_SLOT_COUNT * quickSlot + (QUICK_SLOT_COUNT - 1) * quickGap;
  const quickX = dpadX + (dpadSize - quickRowW) / 2;
  const quickY = bandY + 8;
  const dpadY = quickY + quickSlot + 8;

  return {
    isLandscape: false,
    bandY,
    dpadBtn, dpadGap, dpadSize, dpadX, dpadY,
    quickSlot, quickGap, quickX, quickY,
    quickRects: quickRects(quickX, quickY, quickSlot, quickGap)
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

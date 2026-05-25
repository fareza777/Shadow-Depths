/**
 * Control-band geometry — D-pad (full size in band) + quick-use above the band edge.
 */
import {
  CANVAS_HEIGHT, CONTROL_HEIGHT,
  SIDE_CONTROL_WIDTH, IS_LANDSCAPE
} from '../config/constants.js';

export const QUICK_SLOT_COUNT = 3;

/** D-pad only — centered in the control band, original button sizes. */
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
  const bandY = CANVAS_HEIGHT - CONTROL_HEIGHT;
  const dpadBtn = 56;
  const dpadGap = 5;
  const dpadSize = dpadBtn * 3 + dpadGap * 2;
  return {
    isLandscape: false,
    bandY,
    dpadBtn,
    dpadGap,
    dpadSize,
    dpadX: 10,
    dpadY: bandY + (CONTROL_HEIGHT - dpadSize) / 2
  };
}

/** Quick-use row sits above the control band top line (not inside the band). */
export function getQuickUseLayout() {
  const dpad = getDpadLayout();
  const quickSlot = IS_LANDSCAPE ? 40 : 44;
  const quickGap = 6;
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
      quickRects: quickRects(quickX, quickY, quickSlot, quickGap)
    };
  }

  const quickX = dpad.dpadX + (dpad.dpadSize - quickRowW) / 2;
  const quickY = dpad.bandY - quickSlot - 10;

  return {
    quickSlot,
    quickGap,
    quickX,
    quickY,
    quickRowW,
    bandTop: dpad.bandY,
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

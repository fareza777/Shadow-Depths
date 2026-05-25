/**
 * Control-band geometry — uses runtime Layout (see layoutMetrics.js).
 */
import { Layout } from '../config/layoutMetrics.js';

export const QUICK_SLOT_COUNT = 3;
export const QUICK_ACTIONS = [
  { type: 'vigil', label: 'HERO' },
  { type: 'inventory', label: 'BAG' },
  { type: 'pickup', label: 'PICK' }
];

export function getViewportBottomY() {
  return Layout.canvasH - Layout.control;
}

function portraitBandMetrics() {
  const bandY = getViewportBottomY();
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

export function getDpadLayout() {
  if (!Layout.portrait) {
    const stripW = Layout.sideW;
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
      dpadY: Layout.hud + 10
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

export function getQuickUseLayout() {
  const dpad = getDpadLayout();
  const quickSlot = Layout.portrait ? 44 : 40;
  const quickGap = Layout.portrait ? 4 : 6;
  const quickRowW = QUICK_SLOT_COUNT * quickSlot + (QUICK_SLOT_COUNT - 1) * quickGap;

  if (!Layout.portrait) {
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
  const actionW = Math.max(44, Math.floor((Layout.canvasW - actionX - 10 - actionGap * 2) / 3));

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

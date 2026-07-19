import { TILE_SIZE } from '../config/constants.js';
import { viewportX, viewportY, viewportW, viewportH } from '../config/layoutMetrics.js';
import { fillRect } from './SpriteRegistry.js';

const THREAT_COLORS = {
  attack: '#ff6060',
  ranged: '#80b0e0',
  move: '#a0a0aa',
  wait: '#c0a060',
  default: '#d6d6da'
};

const HIGH_CONTRAST_COLORS = {
  attack: '#ff8a8a',
  ranged: '#a8d4ff',
  move: '#d0d0dc',
  wait: '#ffd070',
  default: '#ffffff'
};

function threatColor(key, opts = {}) {
  const palette = opts.highContrast ? HIGH_CONTRAST_COLORS : THREAT_COLORS;
  return palette[key] || palette.default;
}

export function drawTelegraphs(ctx, floor, player, camera, opts = {}) {
  if (!ctx || !floor || !player) return;
  const cam = camera || { x: 0, y: 0 };
  const inferThreatIntent = opts.inferThreatIntent || _inferThreatIntent;

  ctx.save();
  ctx.beginPath();
  ctx.rect(viewportX(), viewportY(), viewportW(), viewportH());
  ctx.clip();
  ctx.translate(cam.x, cam.y);

  for (const e of floor.enemies()) {
    if (e.isDead) continue;
    const tile = floor.tileAt(e.x, e.y);
    if (!tile || !tile.visible) continue;
    const intent = e.intent || inferThreatIntent(e, player);
    if (!intent) continue;
    if (intent.type === 'ranged') {
      _drawThreatLine(
        ctx,
        e.x,
        e.y,
        intent.target?.x ?? player.x,
        intent.target?.y ?? player.y,
        opts
      );
    }
    // Boss slam telegraph tiles (lean-safe flat fills).
    if (intent.meta?.slam && Array.isArray(intent.meta.tiles)) {
      for (const tile of intent.meta.tiles) {
        _drawThreatTile(ctx, tile.x, tile.y, threatColor('wait', opts), opts.highContrast ? 0.28 : 0.2);
      }
    }
  }
  ctx.restore();
}

export function _inferThreatIntent(enemy, player) {
  // Lightweight fallback when GameScene has not stamped e.intent yet.
  // Full telegraph uses behavior.previewIntent via GameScene._peekEnemyIntent.
  const d = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
  if (d === 1) return { type: 'attack' };
  return null;
}

export function _drawThreatTile(ctx, tx, ty, color, alpha) {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  ctx.save();
  ctx.globalAlpha = alpha;
  fillRect(ctx, x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16, color);
  ctx.restore();
}

export function _drawThreatLine(ctx, x0, y0, x1, y1, opts = {}) {
  const color = threatColor('ranged', opts);
  ctx.save();
  ctx.globalAlpha = opts.highContrast ? 0.78 : 0.62;
  ctx.strokeStyle = color;
  ctx.lineWidth = opts.highContrast ? 3 : 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo((x0 + 0.5) * TILE_SIZE, (y0 + 0.5) * TILE_SIZE);
  ctx.lineTo((x1 + 0.5) * TILE_SIZE, (y1 + 0.5) * TILE_SIZE);
  ctx.stroke();
  ctx.setLineDash([]);
  _drawThreatTile(ctx, x1, y1, color, opts.highContrast ? 0.24 : 0.18);
  ctx.restore();
}

export function _drawIntentIcon(ctx, intent, px, py, opts = {}) {
  let glyph = '';
  let color = threatColor('default', opts);
  if (intent.type === 'attack') { glyph = '!'; color = threatColor('attack', opts); }
  else if (intent.type === 'ranged') { glyph = '>'; color = threatColor('ranged', opts); }
  else if (intent.type === 'move') { glyph = '.'; color = threatColor('move', opts); }
  else if (intent.type === 'wait') {
    glyph = intent.meta?.slam ? '!!' : (intent.meta?.winding ? '!!' : '...');
    color = threatColor('wait', opts);
  }
  if (!glyph) return;
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = color;
  ctx.fillText(glyph, px + TILE_SIZE / 2, py - 8);
}

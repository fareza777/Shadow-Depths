/**
 * Weapon sprite composer.
 *
 * Given a base weapon spriteKey + affix ids, returns a `paint(ctx, x, y, s)`
 * function that draws the canonical weapon on top of an affix overlay
 * (gem socket for prefixes, blade glow / shaft wrap for suffixes).
 *
 * The point: a rolled "Burning Iron Sword of Thirst" should LOOK different
 * from a plain "Iron Sword" without authoring a new pixel grid per affix.
 *
 * Used by SpriteRegistry — when an item's def has `.affixes`, the registry
 * draws the base sprite then layers the composer overlay on top.
 */

const AFFIX_GLOW = {
  // prefixes
  sharp:      '#ffffff',
  keen:       '#bcd6ff',
  merciless:  '#ff6060',
  burning:    '#ff8844',
  cursed:     '#c060ff',
  reinforced: '#a89e88',
  guarded:    '#bcd6ff',
  bulwark:    '#7faafa',
  hardy:      '#f0c0a0',
  iron:       '#9a8e9a',
  cracked:    '#5a5240',
  gilded:     '#f1d49a',
  arcane:     '#c060ff',
  ember:      '#ff8844',
  // suffixes
  of_thirst:        '#c4503a',
  of_deep_thirst:   '#ff4040',
  of_warding:       '#7faafa',
  of_iron_ward:     '#bcd6ff',
  of_vigor:         '#88c656',
  of_great_vigor:   '#a0ff60',
  of_fury:          '#ff6060',
  of_swiftness:     '#a0ffd0',
  of_haste:         '#60ffa0',
  of_the_bear:      '#a89e88',
  of_purity:        '#fff0a0',
  of_executioner:   '#ff8844',
  of_the_choir:     '#f1d49a',
  of_serpents:      '#88c656'
};

/**
 * Paint affix overlay on top of a weapon sprite.
 * Prefix → gem socket near the pommel (top-left of grid).
 * Suffix → blade-edge glow band along the right side.
 *
 * Coordinates are in 32×32 tile space so this works at any render scale.
 */
export function paintWeaponAffix(ctx, x, y, size, affixes) {
  if (!affixes) return;
  const u = size / 32;
  const eps = 0.5;
  const px = (cx, cy, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + cx * u, y + cy * u, w * u + eps, h * u + eps);
  };

  // Prefix gem socket — small bright square + glow ring near pommel.
  if (affixes.prefix) {
    const col = AFFIX_GLOW[affixes.prefix] || '#d4ac6c';
    px(20, 4, 2, 2, '#08060c');
    px(20, 4, 2, 1, col);
    px(21, 5, 1, 1, '#ffffff');
    // Soft glow
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + 21 * u, y + 5 * u, 3 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Suffix blade-edge glow — vertical streak overlaying the blade pixels.
  if (affixes.suffix) {
    const col = AFFIX_GLOW[affixes.suffix] || '#bcd6ff';
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = col;
    // Streak runs along the typical blade column (x≈15-17 in 32-grid sprites).
    ctx.fillRect(x + 15 * u, y + 6 * u, 3 * u, 12 * u);
    ctx.restore();
    // Sparkle dot.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 16 * u, y + 10 * u, 1 * u + eps, 1 * u + eps);
  }
}

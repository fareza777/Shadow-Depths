/**
 * Per-biome ambient backdrop — decoration painted in the VOID area
 * surrounding the playable room. Matches biome-tiles.jsx screenshots
 * (chains, icicles, vines, columns, lava drips, stars, etc.) so each
 * biome reads as a distinct location even before the player enters
 * the room.
 *
 * Public API:
 *   getAbyssPalette(biomeId)          — { top, mid, haze, mote }
 *   drawBiomeDecorations(ctx, viewport, biomeId, time)
 */

const FALLBACK = {
  top: '#08060e', mid: '#030208', haze: '#1a1220', mote: '#d4be7a44'
};

const ABYSS = {
  forgotten_crypts:  { top: '#13101a', mid: '#070512', haze: '#1c1820', mote: '#7a6e8048' },
  bone_garden:       { top: '#1a0e08', mid: '#0a0402', haze: '#3a1a10', mote: '#9a7e5a55' },
  frozen_halls:      { top: '#08101c', mid: '#020610', haze: '#1a3050', mote: '#bfd6ff55' },
  sunken_forest:     { top: '#08120a', mid: '#020a05', haze: '#1a2c10', mote: '#88c65644' },
  iron_stronghold:   { top: '#100c14', mid: '#06040a', haze: '#2a1a20', mote: '#9a8e9a40' },
  sun_cursed_sands:  { top: '#1c1408', mid: '#0a0703', haze: '#3a2810', mote: '#d4ac6c55' },
  mirror_vaults:     { top: '#08060e', mid: '#030208', haze: '#241848', mote: '#d4ac6c40' },
  magma_foundry:     { top: '#180404', mid: '#080101', haze: '#5a1808', mote: '#ff553055' },
  drowned_catacombs: { top: '#061418', mid: '#020a0c', haze: '#1a3a3a', mote: '#6acaba40' },
  void_sanctum:      { top: '#020110', mid: '#000004', haze: '#280c48', mote: '#c08aff55' }
};

export function getAbyssPalette(biomeId) {
  return ABYSS[biomeId] || FALLBACK;
}

/**
 * Decorate the void around the room. The dungeon walls + floors paint
 * over this layer, so anything we draw here only shows through in
 * unexplored / void tiles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,w:number,h:number}} v viewport rect
 * @param {string} biomeId
 * @param {number} time seconds since boot (for gentle drift)
 */
export function drawBiomeDecorations(ctx, v, biomeId, time) {
  const fn = DECORATORS[biomeId];
  if (typeof fn === 'function') fn(ctx, v, time);
}

// ─── helpers ──────────────────────────────────────────────────────
function rect(ctx, x, y, w, h, color, alpha) {
  if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h));
  if (alpha != null) ctx.restore();
}
function circ(ctx, cx, cy, r, color, alpha) {
  if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (alpha != null) ctx.restore();
}
function line(ctx, x1, y1, x2, y2, color, w, alpha) {
  if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (alpha != null) ctx.restore();
}
function gradFill(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

// ─── per-biome decorators ─────────────────────────────────────────

const DECORATORS = {

// 1 · FORGOTTEN CRYPTS — hanging chains + scattered manacles
forgotten_crypts(ctx, v, t) {
  // Chains drape from the top edge of the viewport on both sides.
  for (let c = 0; c < 4; c++) {
    const x = v.x + 18 + c * (v.w / 5);
    const length = 80 + Math.sin(t * 0.4 + c) * 6;
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < length; i += 6) {
      const cx = x + Math.sin((i / 22) + c) * 2;
      const cy = v.y + i;
      ctx.fillStyle = '#3a3340';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 2.4, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1620';
      ctx.fillRect(cx - 0.5, cy - 0.3, 1, 0.6);
    }
    ctx.restore();
  }
  // Scattered ambient stone bricks far below — dim outlines.
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 14; i++) {
    const x = v.x + 12 + ((i * 73) % (v.w - 24));
    const y = v.y + v.h - 30 - ((i * 41) % 80);
    rect(ctx, x, y, 18, 8, '#2a2230');
    rect(ctx, x + 1, y + 1, 16, 1, '#3a3340');
  }
  ctx.restore();
  // Dim corner manacles.
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (const [cx, cy] of [[v.x + 24, v.y + v.h - 60], [v.x + v.w - 26, v.y + v.h - 90]]) {
    ctx.strokeStyle = '#4a4248';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();
    rect(ctx, cx - 2, cy - 16, 4, 8, '#3a3340');
  }
  ctx.restore();
},

// 2 · BONE GARDEN — blood splatter + bone fragments embedded below
bone_garden(ctx, v, t) {
  // Blood haze from below.
  gradFill(ctx, v.x, v.y + v.h * 0.55, v.w, v.h * 0.45, [
    [0, 'rgba(58,8,8,0.00)'],
    [1, 'rgba(58,8,8,0.45)']
  ]);
  // Scattered blood drops.
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 24; i++) {
    const x = v.x + 8 + ((i * 53) % (v.w - 16));
    const y = v.y + v.h - 80 - ((i * 37) % 100);
    circ(ctx, x, y, 2 + (i % 3), i % 4 === 0 ? '#7a1818' : '#3a0808');
  }
  ctx.restore();
  // Embedded bones near the floor.
  ctx.save();
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 5; i++) {
    const x = v.x + 14 + i * (v.w / 5);
    const y = v.y + v.h - 22 + Math.sin(t * 0.3 + i) * 2;
    rect(ctx, x, y, 22, 3, '#9a8e6c');
    circ(ctx, x, y + 1.5, 2.4, '#9a8e6c');
    circ(ctx, x + 22, y + 1.5, 2.4, '#9a8e6c');
  }
  ctx.restore();
},

// 3 · FROZEN HALLS — icicles hanging from top + cold drift
frozen_halls(ctx, v, t) {
  // Icicles from the top edge.
  ctx.save();
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 14; i++) {
    const ix = v.x + 12 + i * ((v.w - 24) / 14);
    const len = 14 + ((i * 13) % 22);
    ctx.fillStyle = '#bfd6ff';
    ctx.beginPath();
    ctx.moveTo(ix - 2, v.y);
    ctx.lineTo(ix + 2, v.y);
    ctx.lineTo(ix, v.y + len);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7faafa';
    ctx.fillRect(ix - 1, v.y, 1, len * 0.7);
  }
  ctx.restore();
  // Drifting snow particles.
  ctx.save();
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 26; i++) {
    const x = v.x + ((i * 41 + Math.sin(t * 0.5 + i) * 18) % v.w);
    const y = v.y + 24 + ((i * 31 + t * 14) % (v.h - 48));
    rect(ctx, x, y, 1.4, 1.4, '#dfeaff');
  }
  ctx.restore();
  // Frozen statues / pillars near bottom.
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 4; i++) {
    const x = v.x + 18 + i * ((v.w - 36) / 3);
    const y = v.y + v.h - 50;
    rect(ctx, x, y, 14, 40, '#5a7090');
    rect(ctx, x + 1, y + 1, 12, 2, '#bfd6ff');
    rect(ctx, x + 4, y + 6, 6, 18, '#7faafa');
  }
  ctx.restore();
},

// 4 · SUNKEN FOREST — vines from top + glowing mushrooms below
sunken_forest(ctx, v, t) {
  // Hanging vines.
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#3a5028';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const x = v.x + 16 + i * ((v.w - 32) / 5);
    const len = 70 + ((i * 23) % 40);
    ctx.beginPath();
    ctx.moveTo(x, v.y);
    for (let k = 0; k < len; k += 8) {
      ctx.lineTo(x + Math.sin(t * 0.3 + k * 0.06 + i) * 4, v.y + k);
    }
    ctx.stroke();
    // Tiny leaves dotted along the vine.
    for (let k = 12; k < len; k += 18) {
      circ(ctx, x + Math.sin(t * 0.3 + k * 0.06 + i) * 4 + 2, v.y + k,
        2, '#5a7838', 0.7);
    }
  }
  ctx.restore();
  // Glowing mushrooms at the bottom.
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const x = v.x + 26 + i * ((v.w - 52) / 4);
    const y = v.y + v.h - 12 - (i % 2) * 6;
    const glow = 0.4 + Math.sin(t * 1.4 + i) * 0.15;
    ctx.globalAlpha = glow;
    circ(ctx, x, y - 6, 7, '#c4ff7f');
    ctx.globalAlpha = 1;
    rect(ctx, x - 0.8, y - 4, 1.6, 4, '#d8cba0');
    circ(ctx, x, y - 6, 2.5, '#88c656');
  }
  ctx.restore();
  // Tiny drifting spores.
  ctx.save();
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 14; i++) {
    const x = v.x + ((i * 37 + t * 8) % v.w);
    const y = v.y + 36 + ((i * 57 - t * 6) % (v.h - 72));
    circ(ctx, x, y, 0.8, '#c4ff7f');
  }
  ctx.restore();
},

// 5 · IRON STRONGHOLD — portcullis bars + chain rivets
iron_stronghold(ctx, v, t) {
  // Vertical portcullis bars descending from the top.
  ctx.save();
  ctx.globalAlpha = 0.65;
  for (let i = 0; i < 7; i++) {
    const x = v.x + 14 + i * ((v.w - 28) / 6);
    const len = v.h - 24;
    // bar
    gradFill(ctx, x - 2, v.y, 4, len, [
      [0, '#9a8e9a'],
      [0.4, '#5a4c54'],
      [1, '#1a1218']
    ]);
    // rivets along the bar
    for (let k = 16; k < len; k += 28) {
      circ(ctx, x, v.y + k, 1.8, '#3a3340');
      circ(ctx, x - 0.6, v.y + k - 0.6, 0.8, '#cfc2a4');
    }
  }
  ctx.restore();
  // Brass piping horizontal accent.
  ctx.save();
  ctx.globalAlpha = 0.35;
  const g = ctx.createLinearGradient(v.x, 0, v.x + v.w, 0);
  g.addColorStop(0, 'transparent');
  g.addColorStop(0.5, '#d4ac6c');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(v.x, v.y + 8, v.w, 1.5);
  ctx.fillRect(v.x, v.y + v.h - 9, v.w, 1.5);
  ctx.restore();
  // Ember glow ambient.
  ctx.save();
  ctx.globalAlpha = 0.15 + Math.sin(t * 1.4) * 0.04;
  const eg = ctx.createRadialGradient(
    v.x + v.w / 2, v.y + v.h * 0.8, 4,
    v.x + v.w / 2, v.y + v.h * 0.8, v.w * 0.6
  );
  eg.addColorStop(0, '#ff884466');
  eg.addColorStop(1, 'transparent');
  ctx.fillStyle = eg;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  ctx.restore();
},

// 6 · SUN-CURSED SANDS — sandstone columns + gold dust
sun_cursed_sands(ctx, v, t) {
  // Three large columns rising from the bottom.
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 3; i++) {
    const x = v.x + 22 + i * ((v.w - 64) / 2);
    const h = v.h * 0.7;
    const y = v.y + v.h - h;
    gradFill(ctx, x, y, 26, h, [
      [0, '#7a5828'],
      [0.5, '#a07840'],
      [1, '#3a2410']
    ]);
    // Capital on top.
    rect(ctx, x - 4, y, 34, 6, '#d4ac6c');
    rect(ctx, x - 4, y - 4, 34, 4, '#a07840');
    // Carved bands.
    for (let k = 14; k < h; k += 24) {
      rect(ctx, x, y + k, 26, 2, '#2a1808', 0.7);
    }
  }
  ctx.restore();
  // Gold dust shimmer drifting.
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 30; i++) {
    const x = v.x + ((i * 23 + t * 12) % v.w);
    const y = v.y + 12 + ((i * 41 + Math.sin(t + i) * 8) % (v.h - 24));
    rect(ctx, x, y, 1.2, 1.2, '#ffd47855');
  }
  ctx.restore();
  // Sun haze top.
  gradFill(ctx, v.x, v.y, v.w, v.h * 0.4, [
    [0, 'rgba(255,170,68,0.18)'],
    [1, 'rgba(255,170,68,0.00)']
  ]);
},

// 7 · MIRROR VAULTS — hanging gold ornaments + marble veins
mirror_vaults(ctx, v, t) {
  // Hanging gold diamond ornaments from top.
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const x = v.x + 24 + i * ((v.w - 48) / 4);
    const len = 22 + (i % 2) * 10;
    ctx.globalAlpha = 0.5;
    line(ctx, x, v.y, x, v.y + len, '#d4ac6c', 1);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#d4ac6c';
    ctx.beginPath();
    ctx.moveTo(x, v.y + len);
    ctx.lineTo(x + 6, v.y + len + 6);
    ctx.lineTo(x, v.y + len + 12);
    ctx.lineTo(x - 6, v.y + len + 6);
    ctx.closePath();
    ctx.fill();
    circ(ctx, x, v.y + len + 6, 1.4, '#fff2c0');
  }
  ctx.restore();
  // Marble columns at sides.
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (const x of [v.x + 6, v.x + v.w - 14]) {
    gradFill(ctx, x, v.y, 8, v.h, [
      [0, '#2a2236'],
      [0.5, '#7a6c84'],
      [1, '#15101e']
    ]);
    // Vertical gold accent.
    rect(ctx, x + 3, v.y + 8, 2, v.h - 16, '#d4ac6c', 0.6);
  }
  ctx.restore();
  // Faint shimmer dots.
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 18; i++) {
    const x = v.x + ((i * 31 + Math.sin(t * 0.6 + i) * 12) % v.w);
    const y = v.y + ((i * 53 + Math.cos(t * 0.4 + i) * 8) % v.h);
    rect(ctx, x, y, 1, 1, '#fff2c0');
  }
  ctx.restore();
},

// 8 · MAGMA FOUNDRY — glowing pillars + lava drips + embers rising
magma_foundry(ctx, v, t) {
  // Vertical lava conduits at sides.
  ctx.save();
  for (const sx of [v.x + 12, v.x + v.w - 22]) {
    const g = ctx.createLinearGradient(sx, v.y, sx, v.y + v.h);
    g.addColorStop(0, '#3a0808');
    g.addColorStop(0.5, '#ff5530');
    g.addColorStop(1, '#1a0404');
    ctx.fillStyle = g;
    ctx.fillRect(sx, v.y, 10, v.h);
    // Bright core.
    ctx.fillStyle = '#ffa040';
    ctx.globalAlpha = 0.7 + Math.sin(t * 2 + sx * 0.02) * 0.2;
    ctx.fillRect(sx + 3, v.y, 4, v.h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Lava drips falling from the top.
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const x = v.x + 36 + i * ((v.w - 72) / 7);
    const fall = (t * 30 + i * 60) % (v.h + 20);
    ctx.globalAlpha = 0.85;
    rect(ctx, x, v.y + fall, 2, 6, '#ff5530');
    ctx.globalAlpha = 0.5;
    rect(ctx, x - 0.5, v.y + fall - 4, 3, 4, '#ffa040');
  }
  ctx.restore();
  // Rising embers.
  ctx.save();
  for (let i = 0; i < 20; i++) {
    const x = v.x + ((i * 27) % v.w);
    const y = v.y + v.h - ((t * 14 + i * 47) % v.h);
    ctx.globalAlpha = 0.65;
    rect(ctx, x, y, 2, 2, i % 3 === 0 ? '#ffa040' : '#ff5530');
  }
  ctx.restore();
  // Red ambient glow.
  ctx.save();
  ctx.globalAlpha = 0.18;
  const rg = ctx.createRadialGradient(
    v.x + v.w / 2, v.y + v.h * 0.5, 4,
    v.x + v.w / 2, v.y + v.h * 0.5, v.w * 0.7
  );
  rg.addColorStop(0, '#ff5530');
  rg.addColorStop(1, 'transparent');
  ctx.fillStyle = rg;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  ctx.restore();
},

// 9 · DROWNED CATACOMBS — hanging algae + rising bubbles + water shimmer
drowned_catacombs(ctx, v, t) {
  // Hanging algae strands from top.
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#3a5848';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const x = v.x + 16 + i * ((v.w - 32) / 7);
    const len = 90 + ((i * 17) % 40);
    ctx.beginPath();
    ctx.moveTo(x, v.y);
    for (let k = 0; k < len; k += 6) {
      ctx.lineTo(x + Math.sin(t * 0.7 + k * 0.05 + i) * 4, v.y + k);
    }
    ctx.stroke();
  }
  // Tiny algae tufts along strands.
  for (let i = 0; i < 8; i++) {
    const x = v.x + 16 + i * ((v.w - 32) / 7);
    for (let k = 14; k < 90; k += 22) {
      circ(ctx, x + Math.sin(t * 0.7 + k * 0.05 + i) * 4, v.y + k, 1.6, '#6acaba');
    }
  }
  ctx.restore();
  // Rising bubbles.
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const x = v.x + 10 + ((i * 49 + Math.sin(t + i) * 6) % (v.w - 20));
    const y = v.y + v.h - ((t * 22 + i * 71) % v.h);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#a8e0d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Water-line ripples near bottom.
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) {
    const y = v.y + v.h - 26 - i * 6;
    ctx.strokeStyle = '#6acaba';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(v.x + 6, y);
    for (let k = 0; k <= v.w - 12; k += 8) {
      ctx.lineTo(v.x + 6 + k, y + Math.sin(k * 0.07 + t * 1.5 + i) * 1.6);
    }
    ctx.stroke();
  }
  ctx.restore();
},

// 10 · VOID SANCTUM — star field + shooting stars + nebula glow
void_sanctum(ctx, v, t) {
  // Nebula glow.
  ctx.save();
  ctx.globalAlpha = 0.4;
  const ng = ctx.createRadialGradient(
    v.x + v.w * 0.5, v.y + v.h * 0.5, 8,
    v.x + v.w * 0.5, v.y + v.h * 0.5, v.w * 0.7
  );
  ng.addColorStop(0, '#9a40e8');
  ng.addColorStop(0.5, '#280c48');
  ng.addColorStop(1, 'transparent');
  ctx.fillStyle = ng;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  ctx.restore();
  // Star field.
  ctx.save();
  for (let i = 0; i < 60; i++) {
    const x = v.x + ((i * 71) % v.w);
    const y = v.y + ((i * 113) % v.h);
    const twinkle = 0.4 + Math.sin(t * 2 + i * 1.7) * 0.4;
    ctx.globalAlpha = twinkle;
    const isPurple = i % 4 === 0;
    rect(ctx, x, y, isPurple ? 1.6 : 1, isPurple ? 1.6 : 1,
      isPurple ? '#c08aff' : '#ffffff');
    if (i % 8 === 0) {
      ctx.globalAlpha = twinkle * 0.4;
      rect(ctx, x - 2, y, 5, 0.5, '#c08aff');
      rect(ctx, x, y - 2, 0.5, 5, '#c08aff');
    }
  }
  ctx.restore();
  // Occasional shooting star.
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 2; i++) {
    const phase = (t * 0.25 + i * 0.5) % 1;
    if (phase > 0.7) continue;
    const sx = v.x + ((i * 311) % v.w);
    const sy = v.y + 40 + ((i * 137) % (v.h - 80));
    const tx = sx + 32, ty = sy + 22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx + phase * 80, sy + phase * 55);
    ctx.lineTo(tx + phase * 80, ty + phase * 55);
    ctx.stroke();
    circ(ctx, tx + phase * 80, ty + phase * 55, 1.5, '#ffffff');
  }
  ctx.restore();
}

};

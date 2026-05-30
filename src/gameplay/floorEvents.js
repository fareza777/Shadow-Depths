/**
 * Floor micro-events — one optional beat per normal floor (shrine, trap room, etc.).
 * Picked deterministically from the floor seed via FloorEventPlacer.
 */
export const EVENT_KINDS = [
  'shrine',
  'trap_room',
  'merchant',
  'rest_alcove',
  'ambush_gate',
  'elite_patrol',
  'hazard_zone',
  'mystery_chest',
  'altar_sacrifice',
  'lore_omen'
];

export const EVENT_LABELS = {
  shrine: 'Shrine',
  trap_room: 'Trap Vault',
  merchant: 'Wandering Merchant',
  rest_alcove: 'Rest Alcove',
  ambush_gate: 'Ambush Gate',
  elite_patrol: 'Elite Patrol',
  hazard_zone: 'Hazard Zone',
  mystery_chest: 'Mystery Chest',
  altar_sacrifice: 'Altar of Sacrifice',
  lore_omen: 'Omen Stone'
};

/** Shrine choices shown in FloorEventPanel. */
export const SHRINE_OPTIONS = [
  {
    id: 'blood_price',
    label: 'Blood Price',
    detail: '−15% HP now · +12% damage this floor',
    apply: (player) => {
      const cut = Math.max(1, Math.floor(player.stats.hpMax * 0.15));
      player.takeDamage(cut);
      addFloorMod(player, { atkPct: 0.12 });
    }
  },
  {
    id: 'veiled_gift',
    label: 'Veiled Gift',
    detail: 'Random material ×2',
    apply: (player, ctx) => {
      const ids = Object.values(ctx.itemDefs || {})
        .filter((d) => d.type === 'material')
        .map((d) => d.id);
      if (!ids.length) return;
      const id = ctx.rng.pick(ids);
      player.addMaterial(id, 2);
    }
  },
  {
    id: 'steady_hand',
    label: 'Steady Hand',
    detail: '+1 ranged focus · heal 20% HP',
    apply: (player) => {
      player.restoreRangedFocus?.(1);
      const missing = player.stats.hpMax - player.stats.hp;
      player.heal(Math.ceil(missing * 0.2));
    }
  }
];

export const MERCHANT_WARES = [
  { id: 'health_potion', cost: 18, label: 'Health Potion' },
  { id: 'antidote', cost: 14, label: 'Antidote' },
  { id: 'scroll_of_identify', cost: 22, label: 'Scroll of Identify' }
];

export const ALTAR_OPTIONS = [
  {
    id: 'sacrifice_hp',
    label: 'Offer Blood',
    detail: 'Lose 12% HP · +8% damage this floor',
    canApply: (p) => p.stats.hp > 2,
    apply: (player) => {
      const cut = Math.max(1, Math.floor(player.stats.hpMax * 0.12));
      player.takeDamage(cut);
      addFloorMod(player, { atkPct: 0.08 });
    }
  },
  {
    id: 'sacrifice_gold',
    label: 'Offer Coin',
    detail: 'Pay 25 gold · +1 torch radius this floor',
    canApply: (p) => p.gold >= 25,
    apply: (player) => {
      player.gold -= 25;
      addFloorMod(player, { torchBonus: 1 });
    }
  },
  {
    id: 'sacrifice_material',
    label: 'Offer Scrap',
    detail: 'Spend 2× any material · restore all focus',
    canApply: (p) => totalMaterials(p) >= 2,
    apply: (player) => {
      const id = firstMaterialId(player);
      if (!id) return;
      player.addMaterial(id, -2);
      player.rangedFocus = player.rangedFocusMax ?? 3;
    }
  }
];

export const LORE_OMENS = [
  {
    id: 'whisper_north',
    label: 'Read the Omen',
    detail: 'Reveal a distant room on the map',
    apply: (_p, ctx) => { ctx.revealRandomRoom?.(); }
  },
  {
    id: 'ember_blessing',
    label: 'Warm the Stone',
    detail: 'Heal 8 HP',
    apply: (player) => { player.heal(8); }
  },
  {
    id: 'warning',
    label: 'Heed the Warning',
    detail: '+5% crit this floor',
    apply: (player) => { addFloorMod(player, { critBonus: 0.05 }); }
  }
];

export function pickMicroEventKind(rng, floorDef, cfg = {}) {
  if (floorDef.type === 'forge' || floorDef.isFinalFloor) return null;
  if (floorDef.enemyCount === 0 && floorDef.type !== 'vault') return null;
  const chance = floorDef.type === 'vault'
    ? (cfg.vaultEventChance ?? 0.35)
    : (cfg.floorEventChance ?? 0.82);
  if (!rng.chance(chance)) return null;
  return rng.pick(EVENT_KINDS);
}

export function resetFloorModifiers(player) {
  if (!player) return;
  player.floorModifiers = { atkPct: 0, defPenalty: 0, torchBonus: 0, critBonus: 0 };
  player.floorCurse = null;
}

export function addFloorMod(player, { atkPct = 0, defPenalty = 0, torchBonus = 0, critBonus = 0 } = {}) {
  if (!player.floorModifiers) resetFloorModifiers(player);
  const m = player.floorModifiers;
  m.atkPct += atkPct;
  m.defPenalty += defPenalty;
  m.torchBonus += torchBonus;
  m.critBonus += critBonus;
}

export function applyFloorModifiersToAtk(base, player) {
  const pct = player?.floorModifiers?.atkPct || 0;
  return Math.max(1, Math.round(base * (1 + pct)));
}

export function applyFloorModifiersToDef(base, player) {
  const pen = player?.floorModifiers?.defPenalty || 0;
  return Math.max(0, base - pen);
}

export function floorCritBonus(player) {
  return player?.floorModifiers?.critBonus || 0;
}

export function floorTorchBonus(player) {
  return player?.floorModifiers?.torchBonus || 0;
}

function totalMaterials(player) {
  return Object.values(player.materials || {}).reduce((a, n) => a + n, 0);
}

function firstMaterialId(player) {
  for (const [id, n] of Object.entries(player.materials || {})) {
    if (n >= 2) return id;
  }
  for (const [id, n] of Object.entries(player.materials || {})) {
    if (n >= 1) return id;
  }
  return null;
}

export function roomKey(room) {
  return `${room.x},${room.y},${room.w},${room.h}`;
}

export function tileInRoom(x, y, room) {
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

export function interactKey(x, y) {
  return `${x},${y}`;
}

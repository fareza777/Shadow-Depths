/**
 * Per-hero passive traits (always on, no extra button).
 * CombatSystem / GameScene / SpellSystem call these hooks.
 */
export const HERO_ROLES = {
  vigil: 'Tank',
  warden: 'Tank',
  hollow: 'Bruiser',
  reaver: 'Bruiser',
  bladedancer: 'Skirmisher',
  inquisitor: 'Skirmisher',
  pilgrim: 'Scout',
  echobinder: 'Caster'
};

export const HERO_PASSIVE_LABELS = {
  vigil: 'Last Stand: +1 DEF below half HP',
  hollow: 'Grave Feeding: heal 1 on kill if wounded',
  inquisitor: 'Still Flame: +1 torch if you did not move',
  reaver: 'Blood Tithe: +1 ATK next turn after a kill',
  pilgrim: 'Wayfarer: heal 4 on descend; −1 damage on floors 1–2 or below half HP',
  warden: 'Phalanx: −1 damage per adjacent foe; −1 poison tick',
  bladedancer: 'Red Waltz: +5% crit per DEX above 4',
  echobinder: 'Void Resonance: −2 damage when wounded; spell grants ward'
};

export function heroRole(kind) {
  return HERO_ROLES[kind] || 'Wanderer';
}

export function heroPassiveLabel(kind) {
  return HERO_PASSIVE_LABELS[kind] || '';
}

/** Bonus DEF from Vigil passive (applied in totalDef). */
export function passiveBonusDef(player) {
  if (!player || player.kind !== 'player') return 0;
  if (player.heroKind === 'vigil') {
    const pct = player.stats.hp / Math.max(1, player.stats.hpMax);
    if (pct <= 0.5) return 1;
  }
  return 0;
}

/** Bonus ATK from Reaver kill buff (applied in totalAtk). */
export function passiveBonusAtk(player) {
  if (!player || player.kind !== 'player') return 0;
  return player._passiveAtkBuff || 0;
}

/** Flat damage reduction before percentage skills (Warden, Echobinder). */
export function passiveFlatDamageReduction(player, floor, attacker) {
  if (!player || player.kind !== 'player' || attacker?.kind !== 'enemy') return 0;
  if (player.heroKind === 'echobinder') {
    const pct = player.stats.hp / Math.max(1, player.stats.hpMax);
    if (pct < 0.8) return 2;
  }
  // Pilgrim Wayfarer: forgiving on early floors and when wounded.
  if (player.heroKind === 'pilgrim') {
    const floorIdx = floor?.definition?.index ?? 99;
    const pct = player.stats.hp / Math.max(1, player.stats.hpMax);
    if (floorIdx <= 1 || pct <= 0.5) return 1;
  }
  if (player.heroKind !== 'warden' || !floor) return 0;
  let adjacent = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ent = floor.entityAt(player.x + dx, player.y + dy);
      if (ent?.kind === 'enemy' && !ent.isDead) adjacent++;
    }
  }
  // −1 per adjacent foe (duel still protected); cap 2 so packs don't become invincible.
  return Math.min(2, adjacent);
}

/** Warden takes softer poison ticks (stacks still matter, but less spike). */
export function passivePoisonTickDamage(player, rawValue) {
  if (!player || player.kind !== 'player' || player.heroKind !== 'warden') return rawValue;
  return Math.max(1, (rawValue || 1) - 1);
}

/** Extra crit chance from Bladedancer passive. */
export function passiveCritBonus(player) {
  if (!player || player.heroKind !== 'bladedancer') return 0;
  const extraDex = Math.max(0, (player.stats.dex || 0) - 4);
  return extraDex * 0.05;
}

/** Called when the player kills an enemy. */
export function onHeroKill(player, { kind } = {}) {
  if (!player || player.kind !== 'player') return;
  if (player.heroKind === 'hollow' && player.stats.hp < player.stats.hpMax) {
    player.heal(1);
  }
  if (player.heroKind === 'reaver') {
    player._passiveAtkBuff = 1;
  }
}

/** Tick down turn-based passive buffs at end of player turn. */
export function tickHeroPassivesEndOfTurn(player) {
  if (!player) return;
  player._passiveAtkBuff = 0;
  if (player.torchBoostTurns > 0) {
    player.torchBoostTurns -= 1;
    if (player.torchBoostTurns <= 0) {
      player.torchBoostTurns = 0;
      player.torchBoostAmount = 0;
    }
  }
}

/** Mark that the player moved this turn (Inquisitor torch). */
export function markHeroMoved(player) {
  if (player) player._inquisitorMoved = true;
}

/** Call when a new player turn begins (after enemies acted). */
export function beginPlayerTurnPassives(player) {
  if (player) player._inquisitorMoved = false;
}

export function effectiveTorchRadius(player) {
  if (!player) return 5;
  let r = player.torchRadius ?? 5;
  if (player.heroKind === 'inquisitor' && !player._inquisitorMoved) r += 1;
  if (player.torchBoostTurns > 0) r += player.torchBoostAmount || 0;
  r += player.floorModifiers?.torchBonus || 0;
  return r;
}

/** Echobinder: apply slow after spell damage (freeze handled in SpellSystem). */
export function onHeroSpellHit(player, target, bus) {
  if (!player || player.heroKind !== 'echobinder' || !target || target.isDead) return;
  if (target.applyStatus?.({ status: 'slow', value: 2, duration: 2 })) {
    bus?.emit('entity:status', { entity: target, status: 'slow' });
  }
}

/** Pilgrim: small heal when changing floors. */
export function onHeroDescend(player) {
  if (player?.heroKind === 'pilgrim') player.heal(4);
}

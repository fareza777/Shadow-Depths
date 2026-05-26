/**
 * TriggerSystem — proc / condition router.
 *
 * Built on top of EffectRegistry. Items, skills, and (eventually) crafted
 * affixes declare triggers of the form:
 *
 *     triggers: [
 *       { when: 'onCrit',        do: { type: 'damage', value: 3 } },
 *       { when: 'onKill',        do: { type: 'heal',   value: 2 } },
 *       { when: 'onHpBelow',     pct: 0.3,
 *                                do: { type: 'applyStatus', status: 'atk_buff', value: 2, duration: 3 } },
 *       { when: 'onTurnStart',   chance: 0.1,
 *                                do: { type: 'heal',   value: 1 } }
 *     ]
 *
 * Supported `when`:
 *   onHit       — attacker landed any hit
 *   onCrit      — attacker landed a crit
 *   onKill      — attacker reduced target to 0 HP
 *   onDamaged   — entity took damage
 *   onHpBelow   — entity's HP fraction crossed below `pct` this tick
 *   onTurnStart — entity's turn started
 *   onMove      — entity moved a tile
 *
 * Optional gates on every trigger:
 *   chance: 0..1   (rng roll)
 *   tag:           (filter target by tag, e.g. 'undead')
 *   cooldown:      (turns before it can fire again)  ← future
 */
import { applyEffect } from './EffectRegistry.js';

/** Gather triggers that match `when` from the actor's equipped items + skills. */
export function collectTriggers(actor, when) {
  if (!actor) return [];
  const out = [];
  const sources = [];

  // Equipped pieces (player). Each may carry a `triggers` array.
  if (typeof actor.equippedPieces === 'function') {
    for (const p of actor.equippedPieces()) {
      if (Array.isArray(p?.triggers)) sources.push(p);
    }
  }
  // Direct entity triggers — e.g. enemy proc list.
  if (Array.isArray(actor.triggers)) sources.push(actor);

  for (const src of sources) {
    for (const trig of src.triggers) {
      if (trig.when === when) out.push({ trig, src });
    }
  }
  return out;
}

/**
 * Fire every matching trigger for `when` on `actor`. Each trigger's effect
 * is applied through the EffectRegistry with a fully-formed ctx.
 *
 * @param {string} when — see header for supported events
 * @param {object} ctx  — { actor, target?, floor?, bus, rng?, damageDealt?, hpPctBefore?, hpPctAfter? }
 * @returns {number} count of triggers that actually fired
 */
export function fireTriggers(when, ctx) {
  const actor = ctx.actor;
  if (!actor) return 0;
  const matched = collectTriggers(actor, when);
  if (matched.length === 0) return 0;

  let fired = 0;
  for (const { trig, src } of matched) {
    if (!gatePasses(trig, ctx)) continue;
    if (!trig.do) continue;
    const effectCtx = {
      ...ctx,
      source: ctx.source || 'trigger',
      sourceRef: src,
      target: trig.do?.target === 'self' ? actor : (ctx.target || actor)
    };
    if (applyEffect(trig.do, effectCtx)) fired++;
  }
  return fired;
}

/** Evaluate trigger gating: chance, hp-below threshold, tag filter. */
function gatePasses(trig, ctx) {
  // hp-below: fires only when hpPctAfter crossed below pct from above.
  if (trig.when === 'onHpBelow') {
    const before = ctx.hpPctBefore;
    const after = ctx.hpPctAfter;
    if (before == null || after == null) return false;
    const t = trig.pct ?? 0.3;
    if (!(before > t && after <= t)) return false;
  }
  // chance gate
  if (typeof trig.chance === 'number' && ctx.rng) {
    if (!ctx.rng.chance(trig.chance)) return false;
  }
  // tag gate — filter by target tags / kind
  if (trig.tag && ctx.target) {
    const tags = ctx.target.tags || [];
    const defId = ctx.target.defId || '';
    if (!tags.includes(trig.tag) && !defId.includes(trig.tag)) return false;
  }
  return true;
}

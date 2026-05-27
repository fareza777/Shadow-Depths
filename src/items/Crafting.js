/**
 * Crafting engine.
 *
 * A recipe (see data/recipes.json) declares:
 *   inputs: [{ materialId, count }, ...]       — consumed from inventory
 *   baseSlot: 'weapon' | 'armor' | ...          — what slot the result is
 *   guaranteedPrefix?: string                   — affix id forced on the roll
 *   guaranteedSuffix?: string                   — affix id forced on the roll
 *   tierBoost?: number                          — adds to the floor-derived
 *                                                 affix tier cap when rolling
 *                                                 the OTHER affix slot
 *   operation?: 'reroll'                        — special: re-roll an
 *                                                 existing item's affixes
 *
 * Public surface:
 *   loadRecipes(json)
 *   listRecipes()
 *   canCraft(player, recipe) → { ok, missing? }
 *   craft(player, recipe, ctx) → { ok, item?, reason? }
 *
 * Uses the existing affix generator + RNG so crafted items are
 * distributionally consistent with floor drops.
 */
import { rollItemAffixes, synthesizeDef } from './itemGenerator.js';
import { Item } from './Item.js';

let RECIPES = [];
const RECIPE_BY_ID = new Map();

export function loadRecipes(json) {
  RECIPES = Array.isArray(json?.recipes) ? json.recipes : [];
  RECIPE_BY_ID.clear();
  for (const r of RECIPES) RECIPE_BY_ID.set(r.id, r);
}

export function listRecipes() { return RECIPES; }
export function getRecipe(id) { return RECIPE_BY_ID.get(id) || null; }

/**
 * Count how many of each material the player has, indexed by id.
 * @param {object} inventory
 */
function tallyMaterials(inventory) {
  const tally = new Map();
  for (const item of inventory.slots) {
    if (!item) continue;
    tally.set(item.id, (tally.get(item.id) || 0) + (item.count || 1));
  }
  return tally;
}

/** Returns { ok, missing: [{id, need, have}] }. */
export function canCraft(player, recipe) {
  if (!recipe || !player?.inventory) return { ok: false, missing: [] };
  const tally = tallyMaterials(player.inventory);
  const missing = [];
  for (const input of recipe.inputs || []) {
    const have = tally.get(input.materialId) || 0;
    if (have < input.count) missing.push({ id: input.materialId, need: input.count, have });
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Consume materials from inventory according to recipe.
 * Returns true if all consumed cleanly.
 */
function consumeInputs(inventory, recipe) {
  for (const input of recipe.inputs || []) {
    let remaining = input.count;
    while (remaining > 0) {
      const slotIdx = inventory.slots.findIndex(
        (s) => s && s.id === input.materialId
      );
      if (slotIdx < 0) return false;
      const item = inventory.slots[slotIdx];
      const take = Math.min(remaining, item.count || 1);
      item.count -= take;
      remaining -= take;
      if (item.count <= 0) inventory.slots[slotIdx] = null;
    }
  }
  return true;
}

/**
 * Pick a random base item from the item def pool matching the recipe's
 * baseSlot. Weighted by spawnWeight so common bases dominate.
 */
function pickBase(recipe, itemDefs, rng) {
  const pool = Object.values(itemDefs).filter(
    (d) => d.slot === recipe.baseSlot && !d.affixes
  );
  if (pool.length === 0) return null;
  const weighted = pool.map((d) => ({ value: d, weight: d.spawnWeight || 1 }));
  return rng.weightedPick(weighted);
}

/**
 * Execute a recipe. Materials are consumed up-front; the resulting
 * synthesized def is wrapped in an Item and added to inventory.
 *
 * @param {object} player
 * @param {object} recipe
 * @param {{ itemDefs, rng, floorLevel, targetItem? }} ctx
 *   targetItem only used for operation:'reroll' — the item whose affixes
 *   are stripped and re-rolled.
 * @returns {{ ok:boolean, item?:object, reason?:string }}
 */
export function craft(player, recipe, ctx) {
  if (!recipe) return { ok: false, reason: 'no recipe' };
  if (!player?.inventory) return { ok: false, reason: 'no inventory' };
  const check = canCraft(player, recipe);
  if (!check.ok) return { ok: false, reason: 'missing materials' };

  if (recipe.operation === 'reroll') {
    const target = ctx?.targetItem;
    if (!target) return { ok: false, reason: 'no target item' };
    if (!target.def?.slot) return { ok: false, reason: 'not equipment' };
    if (!consumeInputs(player.inventory, recipe)) {
      return { ok: false, reason: 'consume failed' };
    }
    // Strip + re-roll. Use base def (without affixes) as the seed.
    const baseId = target.def.id;
    const baseDef = ctx.itemDefs?.[baseId];
    if (!baseDef) return { ok: false, reason: 'lost base' };
    const fresh = rollItemAffixes(baseDef, ctx.floorLevel || 1, ctx.rng);
    const newDef = fresh ? synthesizeDef(baseDef, fresh) : baseDef;
    // Mutate in place so the equipped slot reference stays valid.
    Object.assign(target, new Item(newDef, target.count || 1));
    return { ok: true, item: target };
  }

  if (!consumeInputs(player.inventory, recipe)) {
    return { ok: false, reason: 'consume failed' };
  }
  const baseDef = pickBase(recipe, ctx.itemDefs, ctx.rng);
  if (!baseDef) return { ok: false, reason: 'no base item matches slot' };

  // Build the affix set: enforce guaranteed slots; roll the other.
  const floorLevel = (ctx.floorLevel || 1) + (recipe.tierBoost || 0);
  const rolled = rollItemAffixes(baseDef, floorLevel, ctx.rng) || {};
  const affixes = {
    prefix: recipe.guaranteedPrefix || rolled.prefix || null,
    suffix: recipe.guaranteedSuffix || rolled.suffix || null
  };
  const def = synthesizeDef(baseDef, affixes);
  const item = new Item(def, 1);

  // Try to put into inventory; if full, leave it for the caller to handle.
  const overflow = player.inventory.add(item);
  return { ok: true, item, overflow };
}

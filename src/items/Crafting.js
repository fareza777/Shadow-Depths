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
 *   chooseForgeOffers(rng, floorLevel, count)
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
const BIOME_MATERIALS = {
  forgotten_crypts: ['scrap_iron', 'crypt_dust'],
  iron_stronghold: ['scrap_iron', 'iron_chip'],
  bone_garden: ['bone_shard', 'scrap_iron'],
  drowned_catacombs: ['bone_shard', 'crypt_dust'],
  magma_foundry: ['ember_dust', 'scrap_iron'],
  sun_cursed_sands: ['ember_dust', 'sun_glass'],
  frozen_halls: ['frost_thread', 'bone_shard'],
  void_sanctum: ['void_essence', 'bone_shard'],
  mirror_vaults: ['void_essence', 'mirror_shard'],
  sunken_forest: ['verdant_sap', 'bone_shard']
};

function recipeBiomeFit(recipe, biomeId) {
  const mats = BIOME_MATERIALS[biomeId] || [];
  const inputs = recipe.inputs || [];
  if (!inputs.length) return 0;
  let fit = 0;
  for (const inp of inputs) {
    if (mats.includes(inp.materialId)) fit++;
  }
  return fit / inputs.length;
}

function missingMaterialCount(player, recipe) {
  let missing = 0;
  for (const inp of recipe.inputs || []) {
    const have = player?.materialCount?.(inp.materialId) ?? 0;
    if (have < inp.count) missing += inp.count - have;
  }
  return missing;
}

/**
 * Pick forge offers biased toward recipes the player can craft (or nearly craft).
 * @param {object} [ctx] { player, biomeId }
 */
export function chooseForgeOffers(rng, floorLevel = 1, count = 3, ctx = {}) {
  const { player, biomeId } = ctx;
  const pool = RECIPES.filter((r) => (r.floorMin ?? 1) <= floorLevel);
  if (pool.length <= count) return pool.map((r) => r.id);

  const scored = pool.map((r) => {
    const craftable = player ? canCraft(player, r).ok : false;
    const missing = player ? missingMaterialCount(player, r) : 99;
    const biome = recipeBiomeFit(r, biomeId);
    const score = (craftable ? 1000 : 0) - missing * 5 + biome * 20;
    return { id: r.id, score, craftable, missing };
  });
  scored.sort((a, b) => b.score - a.score);

  const offers = [];
  const used = new Set();
  const craftable = scored.filter((s) => s.craftable);
  for (const s of craftable.slice(0, Math.min(2, count))) {
    offers.push(s.id);
    used.add(s.id);
  }
  const nearly = scored.filter((s) => !used.has(s.id) && s.missing <= 3);
  if (offers.length < count && nearly.length) {
    const pick = nearly[0];
    offers.push(pick.id);
    used.add(pick.id);
  }
  const rest = rng?.shuffle
    ? rng.shuffle(scored.filter((s) => !used.has(s.id)))
    : scored.filter((s) => !used.has(s.id));
  for (const s of rest) {
    if (offers.length >= count) break;
    offers.push(s.id);
    used.add(s.id);
  }
  return offers.slice(0, count);
}

/**
 * Count how many of each material the player has, indexed by id.
 * @param {object} inventory
 */
function tallyMaterials(player) {
  const tally = new Map();
  for (const [id, count] of Object.entries(player?.materials || {})) {
    tally.set(id, count || 0);
  }
  // Backwards-compatible fallback for tests / legacy saves that still hold
  // materials in the bag.
  for (const item of player?.inventory?.slots || []) {
    if (!item || item.type !== 'material') continue;
    tally.set(item.id, (tally.get(item.id) || 0) + (item.count || 1));
  }
  return tally;
}

/** Returns { ok, missing: [{id, need, have}] }. */
export function canCraft(player, recipe) {
  if (!recipe || !player?.inventory) return { ok: false, missing: [] };
  const tally = tallyMaterials(player);
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
function consumeInputs(player, recipe) {
  for (const input of recipe.inputs || []) {
    if (typeof player.consumeMaterial === 'function') {
      if (!player.consumeMaterial(input.materialId, input.count)) return false;
      continue;
    }
    let remaining = input.count;
    while (remaining > 0) {
      const slotIdx = player.inventory.slots.findIndex(
        (s) => s && s.id === input.materialId
      );
      if (slotIdx < 0) return false;
      const item = player.inventory.slots[slotIdx];
      const take = Math.min(remaining, item.count || 1);
      item.count -= take;
      remaining -= take;
      if (item.count <= 0) player.inventory.slots[slotIdx] = null;
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
    if (!consumeInputs(player, recipe)) {
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

  if (!consumeInputs(player, recipe)) {
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

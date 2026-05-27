/**
 * Content schema validators.
 *
 * Loaded JSON content (items, enemies, skills, biomes, floors, hero specs)
 * is validated at boot. Failures are logged with a [VALIDATE] prefix and
 * the offending entry id so typos / missing fields surface immediately
 * instead of causing silent runtime bugs.
 *
 * Lightweight, dependency-free — no Zod. Each schema is a plain object:
 *
 *   {
 *     fieldName: { type, required?, oneOf?, min?, max?, of? (item schema) }
 *   }
 *
 * Supported types: 'string' | 'number' | 'boolean' | 'array' | 'object'
 *
 * Validators are NON-FATAL: invalid entries still load (so the game runs),
 * but `validateContent(content)` returns a report you can surface in dev.
 */

import { hasEffect } from '../combat/EffectRegistry.js';
import { listStatuses } from '../combat/StatusEffects.js';
import { PREFIXES, SUFFIXES } from './affixes.js';

const LOG_TAG = '[VALIDATE]';
const STATUS_IDS = new Set(listStatuses());
const PREFIX_IDS = new Set(PREFIXES.map((a) => a.id));
const SUFFIX_IDS = new Set(SUFFIXES.map((a) => a.id));

const ITEM_SCHEMA = {
  id:        { type: 'string', required: true },
  name:      { type: 'string', required: true },
  type:      { type: 'string', oneOf: ['weapon', 'armor', 'helm', 'legs', 'necklace', 'ring', 'consumable', 'scroll', 'throwable', 'material', 'charm', 'tome', 'phial', 'misc', 'passive'] },
  rarity:    { type: 'string', oneOf: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
  slot:      { type: 'string', oneOf: ['weapon', 'armor', 'helm', 'legs', 'necklace', 'ring'] },
  spriteKey: { type: 'string' },
  stackable: { type: 'boolean' },
  maxStack:  { type: 'number', min: 1 },
  stats:     { type: 'object' },
  effects:   { type: 'array' },
  onHit:     { type: 'array' },
  triggers:  { type: 'array' },
  range:     { type: 'number', min: 0 },
  target:    { type: 'string', oneOf: ['tile', 'enemy', 'self'] },
  lore:      { type: 'string' }
};

const ENEMY_SCHEMA = {
  id:        { type: 'string', required: true },
  name:      { type: 'string', required: true },
  spriteKey: { type: 'string' },
  stats:     { type: 'object', required: true },
  xpReward:  { type: 'number', min: 0 },
  goldDrop:  { type: 'array' },
  behavior:  { type: 'string' },
  onHitPlayer: { type: 'array' }
};

const SKILL_SCHEMA = {
  id:          { type: 'string', required: true },
  name:        { type: 'string', required: true },
  description: { type: 'string' }
};

const BIOME_SCHEMA = {
  id:        { type: 'string', required: true },
  name:      { type: 'string', required: true },
  palette:   { type: 'object' },
  enemyPool: { type: 'array' }
};

const SPELL_SCHEMA = {
  name:        { type: 'string', required: true },
  cooldown:    { type: 'number', required: true, min: 0 },
  color:       { type: 'string' },
  description: { type: 'string' },
  range:       { type: 'number', min: 0 },
  radius:      { type: 'number', min: 0 }
};

const ACHIEVEMENT_SCHEMA = {
  id:          { type: 'string', required: true },
  name:        { type: 'string', required: true },
  description: { type: 'string' },
  trigger:     { type: 'string', required: true },
  threshold:   { type: 'number', required: true, min: 1 },
  reward:      { type: 'object' }
};

const SET_SCHEMA = {
  id:          { type: 'string', required: true },
  name:        { type: 'string', required: true },
  pieces:      { type: 'array',  required: true },
  bonuses:     { type: 'array',  required: true }
};

const RECIPE_SCHEMA = {
  id:          { type: 'string', required: true },
  name:        { type: 'string', required: true },
  inputs:      { type: 'array',  required: true }
};

/** Validate a single entry against a schema. Returns array of issues. */
function validateEntry(entry, schema, entryLabel) {
  const issues = [];
  if (!entry || typeof entry !== 'object') {
    issues.push(`${entryLabel}: not an object`);
    return issues;
  }
  for (const [field, spec] of Object.entries(schema)) {
    const v = entry[field];
    const present = v !== undefined && v !== null;
    if (spec.required && !present) {
      issues.push(`${entryLabel}: missing required field "${field}"`);
      continue;
    }
    if (!present) continue;
    const actualType = Array.isArray(v) ? 'array' : typeof v;
    if (spec.type && actualType !== spec.type) {
      issues.push(`${entryLabel}.${field}: expected ${spec.type}, got ${actualType}`);
      continue;
    }
    if (spec.oneOf && !spec.oneOf.includes(v)) {
      issues.push(`${entryLabel}.${field}: "${v}" not in [${spec.oneOf.join(', ')}]`);
    }
    if (spec.type === 'number') {
      if (spec.min !== undefined && v < spec.min) {
        issues.push(`${entryLabel}.${field}: ${v} < min ${spec.min}`);
      }
      if (spec.max !== undefined && v > spec.max) {
        issues.push(`${entryLabel}.${field}: ${v} > max ${spec.max}`);
      }
    }
  }
  return issues;
}

/** Validate a dict of entries keyed by id. */
function validateDict(dict, schema, dictName) {
  const issues = [];
  if (!dict || typeof dict !== 'object') return issues;
  for (const [key, entry] of Object.entries(dict)) {
    const label = `${dictName}[${key}]`;
    issues.push(...validateEntry(entry, schema, label));
    // Cross-check: entry.id should match the key when present.
    if (entry?.id && entry.id !== key) {
      issues.push(`${label}: id "${entry.id}" doesn't match key "${key}"`);
    }
  }
  return issues;
}

/** Validate an array of entries. */
function validateArray(arr, schema, arrName) {
  const issues = [];
  if (!Array.isArray(arr)) return issues;
  for (let i = 0; i < arr.length; i++) {
    const entry = arr[i];
    const label = `${arrName}[${entry?.id || i}]`;
    issues.push(...validateEntry(entry, schema, label));
  }
  return issues;
}

function validateEffectSpec(eff, label) {
  const issues = [];
  if (!eff || typeof eff !== 'object') {
    issues.push(`${label}: effect is not an object`);
    return issues;
  }
  if (!eff.type || typeof eff.type !== 'string') {
    issues.push(`${label}: missing effect type`);
    return issues;
  }
  if (!hasEffect(eff.type)) {
    issues.push(`${label}: unknown effect type "${eff.type}"`);
  }
  if (['heal', 'damage', 'maxHP', 'grantXP', 'lifesteal', 'drainXP', 'aoe_damage'].includes(eff.type)) {
    if (typeof eff.value !== 'number') issues.push(`${label}: "${eff.type}" needs numeric value`);
  }
  if (eff.type === 'applyStatus') {
    if (!STATUS_IDS.has(eff.status)) issues.push(`${label}: unknown status "${eff.status}"`);
    if (eff.duration != null && typeof eff.duration !== 'number') issues.push(`${label}: duration must be numeric`);
  }
  if (eff.type === 'aoe_damage' && eff.radius != null && typeof eff.radius !== 'number') {
    issues.push(`${label}: radius must be numeric`);
  }
  return issues;
}

function validateTriggers(triggers, label) {
  const issues = [];
  if (!Array.isArray(triggers)) return issues;
  const validWhen = new Set(['onHit', 'onCrit', 'onKill', 'onDamaged', 'onHpBelow', 'onTurnStart', 'onMove']);
  for (let i = 0; i < triggers.length; i++) {
    const trig = triggers[i];
    const tLabel = `${label}.triggers[${i}]`;
    if (!trig || typeof trig !== 'object') {
      issues.push(`${tLabel}: trigger is not an object`);
      continue;
    }
    if (!validWhen.has(trig.when)) issues.push(`${tLabel}: unknown trigger "${trig.when}"`);
    if (trig.chance != null && (typeof trig.chance !== 'number' || trig.chance < 0 || trig.chance > 1)) {
      issues.push(`${tLabel}: chance must be 0..1`);
    }
    if (trig.cooldown != null && (typeof trig.cooldown !== 'number' || trig.cooldown < 1)) {
      issues.push(`${tLabel}: cooldown must be >= 1`);
    }
    if (trig.when === 'onHpBelow' && (typeof trig.pct !== 'number' || trig.pct <= 0 || trig.pct >= 1)) {
      issues.push(`${tLabel}: onHpBelow needs pct between 0 and 1`);
    }
    issues.push(...validateEffectSpec(trig.do, `${tLabel}.do`));
  }
  return issues;
}

function validateEffectsOnEntries(dict, dictName) {
  const issues = [];
  if (!dict || typeof dict !== 'object') return issues;
  for (const [id, entry] of Object.entries(dict)) {
    const label = `${dictName}[${id}]`;
    for (const field of ['effects', 'onHit', 'onHitPlayer']) {
      if (!Array.isArray(entry?.[field])) continue;
      for (let i = 0; i < entry[field].length; i++) {
        issues.push(...validateEffectSpec(entry[field][i], `${label}.${field}[${i}]`));
      }
    }
    issues.push(...validateTriggers(entry?.triggers, label));
  }
  return issues;
}

/**
 * Run all validators against a loaded content bundle.
 * @param {{items, enemies, skills, biomes, heroSpells}} content
 * @returns {{ ok: boolean, issues: string[], counts: object }}
 */
export function validateContent(content) {
  const issues = [];
  const counts = {};

  if (content.items) {
    counts.items = Object.keys(content.items).length;
    issues.push(...validateDict(content.items, ITEM_SCHEMA, 'items'));
    issues.push(...validateEffectsOnEntries(content.items, 'items'));
  }
  if (content.enemies) {
    counts.enemies = Object.keys(content.enemies).length;
    issues.push(...validateDict(content.enemies, ENEMY_SCHEMA, 'enemies'));
    issues.push(...validateEffectsOnEntries(content.enemies, 'enemies'));
  }
  if (content.skills) {
    const skillsArr = Array.isArray(content.skills) ? content.skills : content.skills.skills;
    if (skillsArr) {
      counts.skills = skillsArr.length;
      issues.push(...validateArray(skillsArr, SKILL_SCHEMA, 'skills'));
    }
  }
  if (content.biomes) {
    const biomesArr = Array.isArray(content.biomes) ? content.biomes : content.biomes.biomes;
    if (biomesArr) {
      counts.biomes = biomesArr.length;
      issues.push(...validateArray(biomesArr, BIOME_SCHEMA, 'biomes'));
    }
  }
  if (content.heroSpells) {
    counts.spells = Object.keys(content.heroSpells).length;
    issues.push(...validateDict(content.heroSpells, SPELL_SCHEMA, 'spells'));
  }
  if (content.achievements) {
    const arr = Array.isArray(content.achievements)
      ? content.achievements
      : content.achievements.achievements;
    if (arr) {
      counts.achievements = arr.length;
      issues.push(...validateArray(arr, ACHIEVEMENT_SCHEMA, 'achievements'));
    }
  }
  if (content.sets) {
    const arr = Array.isArray(content.sets) ? content.sets : content.sets.sets;
    if (arr) {
      counts.sets = arr.length;
      issues.push(...validateArray(arr, SET_SCHEMA, 'sets'));
    }
  }
  if (content.recipes) {
    const arr = Array.isArray(content.recipes) ? content.recipes : content.recipes.recipes;
    if (arr) {
      counts.recipes = arr.length;
      issues.push(...validateArray(arr, RECIPE_SCHEMA, 'recipes'));
    }
  }

  // Cross-reference checks — referenced ids must exist.
  if (content.enemies && content.biomes) {
    const enemyIds = new Set(Object.keys(content.enemies));
    const biomesArr = Array.isArray(content.biomes) ? content.biomes : content.biomes.biomes;
    if (biomesArr) {
      for (const b of biomesArr) {
        if (!Array.isArray(b.enemyPool)) continue;
        for (const eid of b.enemyPool) {
          if (!enemyIds.has(eid)) {
            issues.push(`biomes[${b.id}].enemyPool: unknown enemy id "${eid}"`);
          }
        }
      }
    }
  }

  if (content.recipes && content.items) {
    const recipes = Array.isArray(content.recipes) ? content.recipes : content.recipes.recipes;
    const itemIds = new Set(Object.keys(content.items));
    if (recipes) {
      for (const recipe of recipes) {
        if (!recipe?.id) continue;
        for (const input of recipe.inputs || []) {
          if (!itemIds.has(input.materialId)) {
            issues.push(`recipes[${recipe.id}].inputs: unknown material id "${input.materialId}"`);
          }
          if (typeof input.count !== 'number' || input.count < 1) {
            issues.push(`recipes[${recipe.id}].inputs: invalid count for "${input.materialId}"`);
          }
        }
        if (recipe.guaranteedPrefix && !PREFIX_IDS.has(recipe.guaranteedPrefix)) {
          issues.push(`recipes[${recipe.id}].guaranteedPrefix: unknown affix "${recipe.guaranteedPrefix}"`);
        }
        if (recipe.guaranteedSuffix && !SUFFIX_IDS.has(recipe.guaranteedSuffix)) {
          issues.push(`recipes[${recipe.id}].guaranteedSuffix: unknown affix "${recipe.guaranteedSuffix}"`);
        }
        if (!recipe.operation && !recipe.baseSlot) {
          issues.push(`recipes[${recipe.id}]: needs baseSlot or operation`);
        }
      }
    }
  }

  return { ok: issues.length === 0, issues, counts };
}

/**
 * Log a validation report to console. Quiet in production unless issues.
 * @param {ReturnType<typeof validateContent>} report
 */
export function logValidationReport(report) {
  const { ok, issues, counts } = report;
  const summary = `items=${counts.items ?? 0} enemies=${counts.enemies ?? 0} skills=${counts.skills ?? 0} biomes=${counts.biomes ?? 0} spells=${counts.spells ?? 0} sets=${counts.sets ?? 0} recipes=${counts.recipes ?? 0} ach=${counts.achievements ?? 0}`;
  if (ok) {
    console.log(`${LOG_TAG} content OK — ${summary}`);
    return;
  }
  console.warn(`${LOG_TAG} ${issues.length} content issue(s) — ${summary}`);
  // Cap output so a flood doesn't dominate the console.
  const cap = 30;
  for (const msg of issues.slice(0, cap)) console.warn(`${LOG_TAG} ${msg}`);
  if (issues.length > cap) console.warn(`${LOG_TAG} …${issues.length - cap} more`);
}

/**
 * Headless balance simulator.
 *
 * Rolls N items at a target floor and reports the rarity / affix / slot
 * distribution. Used to sanity-check the affix pool — e.g. "are tier-3
 * affixes actually showing up at floor 60?" or "is sharp+of_thirst too
 * common on weapons?".
 *
 * Usage:
 *   npm run sim                  # default: 5000 rolls at floor 30
 *   node scripts/sim.js 2000 60  # 2000 rolls at floor 60
 *   node scripts/sim.js 1000 1   # tier-1-only sanity check
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rollItemAffixes, synthesizeDef } from '../src/items/itemGenerator.js';

const here = dirname(fileURLToPath(import.meta.url));
const itemsPath = join(here, '..', 'data', 'items.json');
const items = JSON.parse(readFileSync(itemsPath, 'utf-8'));

const ROLL_COUNT = Number(process.argv[2] || 5000);
const FLOOR      = Number(process.argv[3] || 30);

// Tiny mulberry32 — independent of the game's seeded RNG to keep the
// script standalone.
function makeRng(seed = 0xdeadbeef) {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    chance(p) { return this.next() < p; },
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  };
}

const rng = makeRng();

const slotPool = Object.values(items).filter((d) => d.slot);
if (slotPool.length === 0) {
  console.error('[sim] no equippable items in items.json — aborting');
  process.exit(1);
}

const buckets = {
  rarity:   new Map(),
  slot:     new Map(),
  prefix:   new Map(),
  suffix:   new Map(),
  noAffix:  0,
  prefixOnly: 0,
  suffixOnly: 0,
  bothAffix: 0
};

function bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

for (let i = 0; i < ROLL_COUNT; i++) {
  const base = rng.pick(slotPool);
  const affixes = rollItemAffixes(base, FLOOR, rng);
  const def = synthesizeDef(base, affixes);
  bump(buckets.rarity, def.rarity || 'common');
  bump(buckets.slot, def.slot);
  if (affixes?.prefix) bump(buckets.prefix, affixes.prefix);
  if (affixes?.suffix) bump(buckets.suffix, affixes.suffix);
  if (!affixes) buckets.noAffix++;
  else if (affixes.prefix && affixes.suffix) buckets.bothAffix++;
  else if (affixes.prefix) buckets.prefixOnly++;
  else buckets.suffixOnly++;
}

function pct(n) { return ((n / ROLL_COUNT) * 100).toFixed(1) + '%'; }
function sortedRows(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

console.log(`\n[sim] ${ROLL_COUNT} rolls @ floor ${FLOOR}`);
console.log(`[sim] base pool size: ${slotPool.length} items with slot`);
console.log('');
console.log('Affix distribution:');
console.log(`  none           ${pct(buckets.noAffix)}  (${buckets.noAffix})`);
console.log(`  prefix only    ${pct(buckets.prefixOnly)}  (${buckets.prefixOnly})`);
console.log(`  suffix only    ${pct(buckets.suffixOnly)}  (${buckets.suffixOnly})`);
console.log(`  both           ${pct(buckets.bothAffix)}  (${buckets.bothAffix})`);
console.log('');
console.log('Rarity distribution:');
for (const [k, v] of sortedRows(buckets.rarity)) {
  console.log(`  ${k.padEnd(10)} ${pct(v)}  (${v})`);
}
console.log('');
console.log('Slot distribution:');
for (const [k, v] of sortedRows(buckets.slot)) {
  console.log(`  ${k.padEnd(10)} ${pct(v)}  (${v})`);
}
console.log('');
console.log('Prefix top 8:');
for (const [k, v] of sortedRows(buckets.prefix).slice(0, 8)) {
  console.log(`  ${k.padEnd(14)} ${pct(v)}  (${v})`);
}
console.log('');
console.log('Suffix top 8:');
for (const [k, v] of sortedRows(buckets.suffix).slice(0, 8)) {
  console.log(`  ${k.padEnd(14)} ${pct(v)}  (${v})`);
}
console.log('');

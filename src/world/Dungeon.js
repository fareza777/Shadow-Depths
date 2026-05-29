/**
 * Dungeon — the stack of floors for one run.
 *
 * Owns generation cadence and the "current floor" index. Floor instances are
 * generated lazily on descend so memory stays bounded and seeds remain
 * deterministic regardless of which floors the player has explored.
 *
 * Floor definitions are *generated* at runtime by cycling through biomes
 * (data/biomes.json). Each biome covers 5 floors, so:
 *
 *   floors 0..4    → biome 0  (Forgotten Crypts I..V)
 *   floors 5..9    → biome 1  (Halls of Echoes I..V)
 *   ...
 *   floors 95..99  → biome 19 (The Below I..V)
 *
 * The result is 100 floors with 20 distinct biomes. Floors.json is still
 * read as an *override* (used to ship a hand-tuned tutorial for the first
 * few floors if we ever add one); without overrides we fall back to the
 * procedural biome curve.
 */
import { LOG } from '../config/constants.js';
import { DungeonGenerator } from './DungeonGenerator.js';

// 10 biomes × 10 floors each = 100 total floors. Matches biome-tiles.jsx.
const FLOORS_PER_BIOME = 10;
const TOTAL_FLOORS = 100;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const SUBBOSS_IDS = [
  'subboss_cairn_knight',
  'subboss_veil_stalker',
  'subboss_iron_prior',
  'subboss_void_seraph'
];
const BOSS_IDS = [
  'boss_crypt_regent',
  'boss_ash_titan',
  'boss_sunless_oracle',
  'boss_the_below'
];

export class Dungeon {
  /**
   * @param {object} deps { balance, rng, content }
   */
  constructor({ balance, rng, content }) {
    this.balance = balance;
    this.rng = rng;
    this.content = content;
    this.generator = new DungeonGenerator(balance, rng.fork('dungeon'));

    // Optional hand-authored overrides (data/floors.json). Indexed by
    // floor index. Absent entries are filled procedurally from biomes.
    this.overrides = Dungeon._indexOverrides(content.floors);
    this.biomes = (content.biomes && content.biomes.biomes) || [];

    // Pre-compute the full floor list once. Cheap (≤ TOTAL_FLOORS entries).
    this.floorDefs = this._buildFloorList();

    /** @type {Map<number, { floor: import('./Floor.js').Floor, spawns: object }>} */
    this._cache = new Map();
    this.currentIndex = 0;
  }

  get totalFloors() { return this.floorDefs.length; }

  isFinalFloor(index = this.currentIndex) {
    const def = this.floorDefs[index];
    return !!(def && def.isFinalFloor);
  }

  getOrGenerate(index) {
    if (this._cache.has(index)) return this._cache.get(index);
    const def = this.floorDefs[index];
    if (!def) throw new Error(`Dungeon: no floor definition for index ${index}`);
    const result = this.generator.generate(
      index,
      def,
      this.content.items || {},
      this.content.enemies || {}
    );
    this._cache.set(index, result);
    console.log(LOG.DUNGEON, `generated floor ${index + 1} — ${def.name}`,
      { rooms: result.floor.rooms.length, enemies: result.spawns.enemies.length });
    return result;
  }

  current() {
    return this.getOrGenerate(this.currentIndex);
  }

  descend() {
    const next = this.currentIndex + 1;
    if (next >= this.floorDefs.length) return null;
    this.currentIndex = next;
    return this.current();
  }

  // --- procedural floor list ------------------------------------------
  _buildFloorList() {
    const out = [];
    const biomeCount = this.biomes.length || 1;

    for (let i = 0; i < TOTAL_FLOORS; i++) {
      const override = this.overrides[i];
      if (override) {
        // Even when a floor is hand-authored in floors.json we still want
        // the biome's detailed tile renderer. Compute the biome the same
        // way the procedural branch does and stamp biomeId onto the
        // override so Renderer.drawFloor dispatches to biomeTiles.js.
        const biomeIdx = Math.min(biomeCount - 1, Math.floor(i / FLOORS_PER_BIOME) % biomeCount);
        const biome = this.biomes[biomeIdx];
        out.push({
          ...override,
          index: i,
          biomeId: override.biomeId || biome?.id || 'forgotten_crypts',
          isFinalFloor: i === TOTAL_FLOORS - 1
        });
        continue;
      }

      // Pick biome by depth. Cycle if we have fewer than 20 biomes.
      const biomeIdx = Math.min(biomeCount - 1, Math.floor(i / FLOORS_PER_BIOME) % biomeCount);
      const biome = this.biomes[biomeIdx];
      const positionInBiome = i % FLOORS_PER_BIOME;
      const roman = ROMAN[positionInBiome] || `${positionInBiome + 1}`;

      const isFinal = (i === TOTAL_FLOORS - 1) || !!biome?.isFinalBiome && positionInBiome === FLOORS_PER_BIOME - 1
        && biomeIdx === biomeCount - 1;
      const floorNumber = i + 1;
      const specialEnemyId = this._specialEnemyForFloor(floorNumber);

      // Special floor types: forge sanctuary (7, 17, 27...) + vault (10s).
      // Floor 100 stays the boss arena, so we don't override the last floor.
      let type = null;
      let enemyCount = Math.min(14, 3 + Math.floor(i * 0.2) + (i >= 40 ? 1 : 0));
      let itemCount  = Math.min(8,  5 + Math.floor(i * 0.04));
      let vaultDepthBoost = 0;
      const isLast = i === TOTAL_FLOORS - 1;
      if (!isLast) {
        if (floorNumber % 10 === 0) {
          type = 'vault';
          enemyCount = Math.max(2, enemyCount - 1);
          itemCount += 2;
          vaultDepthBoost = 12;  // affix tier nudge for items spawned here
        } else if (floorNumber % 10 === 7) {
          type = 'forge';
          enemyCount = 0;
          itemCount = 0;
        }
      }

      out.push({
        index: i,
        name: biome ? `${biome.name} ${roman}` : `Floor ${i + 1}`,
        subtitle: `Floor ${i + 1}`,
        atmosphere: biome?.atmosphere || '',
        wallPalette: biome?.wallPalette || ['#3a3340', '#1a1820'],
        floorPalette: biome?.floorPalette || ['#2a2630', '#15131a'],
        enemyPool: biome?.enemyPool || ['goblin_scout'],
        enemyCount, itemCount,
        torchRadius: biome?.torchRadius || 5,
        // Steeper curve after floor 25 — counters longbow + revive stacking.
        depthScale: 1 + i * 0.09 + (i > 25 ? (i - 25) * 0.02 : 0),
        specialEnemyId,
        biomeId: biome?.id || 'unknown',
        type,
        vaultDepthBoost,
        isFinalFloor: isFinal
      });
    }
    // Force the last floor to be the final, regardless of biome flags.
    if (out.length > 0) out[out.length - 1].isFinalFloor = true;
    return out;
  }

  static _indexOverrides(floorsContent) {
    const map = {};
    if (!floorsContent || !Array.isArray(floorsContent.floors)) return map;
    for (const def of floorsContent.floors) {
      if (typeof def.index === 'number') map[def.index] = def;
    }
    return map;
  }

  _specialEnemyForFloor(floorN) {
    if (floorN < 5) return null;
    const tier = Math.min(
      SUBBOSS_IDS.length - 1,
      Math.floor((floorN - 1) / 25)
    );
    if (floorN % 10 === 0) {
      return BOSS_IDS[Math.min(BOSS_IDS.length - 1, tier)];
    }
    if (floorN % 5 === 0) return SUBBOSS_IDS[tier];
    return null;
  }
}

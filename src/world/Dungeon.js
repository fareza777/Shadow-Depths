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

const FLOORS_PER_BIOME = 5;
const TOTAL_FLOORS = 100;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

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
        out.push({ ...override, index: i, isFinalFloor: i === TOTAL_FLOORS - 1 });
        continue;
      }

      // Pick biome by depth. Cycle if we have fewer than 20 biomes.
      const biomeIdx = Math.min(biomeCount - 1, Math.floor(i / FLOORS_PER_BIOME) % biomeCount);
      const biome = this.biomes[biomeIdx];
      const positionInBiome = i % FLOORS_PER_BIOME;
      const roman = ROMAN[positionInBiome] || `${positionInBiome + 1}`;

      const isFinal = (i === TOTAL_FLOORS - 1) || !!biome?.isFinalBiome && positionInBiome === FLOORS_PER_BIOME - 1
        && biomeIdx === biomeCount - 1;

      out.push({
        index: i,
        name: biome ? `${biome.name} ${roman}` : `Floor ${i + 1}`,
        subtitle: `Floor ${i + 1}`,
        atmosphere: biome?.atmosphere || '',
        wallPalette: biome?.wallPalette || ['#3a3340', '#1a1820'],
        floorPalette: biome?.floorPalette || ['#2a2630', '#15131a'],
        enemyPool: biome?.enemyPool || ['goblin_scout'],
        // Difficulty curves: enemies & items both scale gently with depth.
        // Capped so floor 100 isn't a meat grinder of 30 enemies.
        enemyCount: Math.min(12, 3 + Math.floor(i * 0.18)),
        itemCount:  Math.min(8,  5 + Math.floor(i * 0.04)),
        torchRadius: biome?.torchRadius || 5,
        depthScale: 1 + i * 0.08, // enemy HP/ATK multiplier — read by spawner
        biomeId: biome?.id || 'unknown',
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
}

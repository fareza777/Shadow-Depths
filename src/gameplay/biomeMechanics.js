/**
 * biomeMechanics — light per-turn pressure keyed by biome.mechanic.
 *
 * Effects stay gentle: occasional chip damage, brief statuses, torch
 * flicker, and flavor log lines. Heavy combat threat still comes from
 * enemies / hazards, not the biome tick.
 */

const DESCRIPTIONS = {
  torch_drain:   'Damp air eats at your flame — torchlight fades here.',
  bleed_tiles:   'Bone shards underfoot nick your steps.',
  slow_tiles:    'Frost clings to your boots; footing turns sluggish.',
  lava_pressure: 'Heat presses in from every forge vent.',
  root_snare:    'Roots whisper under stone, ready to tangle ankles.',
  armor_break:   'Iron grit finds every joint of your armor.',
  heat_fatigue:  'Sun-cursed air saps strength with each breath.',
  echo_clone:    'Your footsteps answer themselves from the mirrors.',
  flood_slow:    'Brackish water tugs at every stride.',
  void_vision:   'The void thins what your eyes can trust.'
};

/**
 * @param {string} biomeId
 * @param {object|object[]} biomesData — biomes.json root `{ biomes: [...] }` or array
 * @returns {string|null}
 */
export function getBiomeMechanic(biomeId, biomesData) {
  if (!biomeId) return null;
  const arr = Array.isArray(biomesData)
    ? biomesData
    : (biomesData?.biomes || []);
  const biome = arr.find((b) => b?.id === biomeId);
  return biome?.mechanic || null;
}

/** Human-readable UI blurb for a mechanic id. */
export function describeBiomeMechanic(mechanic) {
  if (!mechanic) return '';
  return DESCRIPTIONS[mechanic] || '';
}

/**
 * Apply gentle end-of-turn biome pressure.
 * @param {object} player
 * @param {object} floor — expects definition.mechanic or definition.biomeId
 * @param {object} [bus]
 */
export function applyBiomeTurnTick(player, floor, bus) {
  if (!player || player.isDead || !floor) return;
  const mechanic = floor.definition?.mechanic
    || getBiomeMechanic(floor.definition?.biomeId, null);
  if (!mechanic) return;

  const turn = player.runStats?.turnsUsed || 0;
  // Most effects pulse every few turns so pressure stays readable, not lethal.
  const pulse = turn > 0 && turn % 5 === 0;

  switch (mechanic) {
    case 'torch_drain':
      if (pulse) {
        ensureFloorMods(player);
        player.floorModifiers.torchBonus = Math.max(
          -1,
          (player.floorModifiers.torchBonus || 0) - 1
        );
        log(bus, 'Your torch sputters in the crypt air.');
      }
      break;

    case 'bleed_tiles':
      if (pulse && player.stats.hp > 3) {
        player.takeDamage(1);
        log(bus, 'Bone dust draws a thin line of blood.');
      }
      break;

    case 'slow_tiles':
      if (pulse) {
        player.applyStatus({ id: 'slow', value: 1, duration: 1 });
        log(bus, 'Frost bites your stride.');
      }
      break;

    case 'lava_pressure':
      if (pulse && player.stats.hp > 4) {
        player.takeDamage(1);
        log(bus, 'Foundry heat sears your lungs.');
      }
      break;

    case 'root_snare':
      if (pulse) {
        player.applyStatus({ id: 'slow', value: 1, duration: 1 });
        log(bus, 'A root catches your heel — then slips away.');
      }
      break;

    case 'armor_break':
      if (pulse) {
        ensureFloorMods(player);
        player.floorModifiers.defPenalty = Math.min(
          1,
          (player.floorModifiers.defPenalty || 0) + 1
        );
        log(bus, 'Grit works into the seams of your armor.');
      }
      break;

    case 'heat_fatigue':
      if (pulse && player.stats.hp > 4) {
        player.takeDamage(1);
        log(bus, 'Heat-fatigue settles into your bones.');
      }
      break;

    case 'echo_clone':
      if (pulse) {
        log(bus, 'An echo of yourself moves a half-step late.');
      }
      break;

    case 'flood_slow':
      if (pulse) {
        player.applyStatus({ id: 'slow', value: 1, duration: 1 });
        log(bus, 'Cold water pulls at your steps.');
      }
      break;

    case 'void_vision':
      if (pulse) {
        ensureFloorMods(player);
        player.floorModifiers.torchBonus = Math.max(
          -2,
          (player.floorModifiers.torchBonus || 0) - 1
        );
        log(bus, 'The void narrows what you can see.');
      }
      break;

    default:
      break;
  }
}

function ensureFloorMods(player) {
  if (!player.floorModifiers) {
    player.floorModifiers = { atkPct: 0, defPenalty: 0, torchBonus: 0, critBonus: 0 };
  }
}

function log(bus, text) {
  bus?.emit?.('log:message', { text, kind: 'warn' });
}

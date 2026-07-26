/**
 * biomeMechanics — light per-turn pressure keyed by biome.mechanic,
 * plus optional spatial pressure tiles stamped at generation.
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

/** Soft step-on effects for spatial biome pressure tiles. */
export const PRESSURE_STEP = {
  torch_drain:   { kind: 'torch', delta: -1, log: 'Damp stone drinks your torchlight.' },
  bleed_tiles:   { kind: 'damage', amount: 1, minHp: 4, log: 'Bone shards nick your soles.' },
  slow_tiles:    { kind: 'status', status: { id: 'slow', value: 1, duration: 1 }, log: 'Frost grips your boots.' },
  lava_pressure: { kind: 'damage', amount: 1, minHp: 5, log: 'Vent-heat scorches your path.' },
  root_snare:    { kind: 'status', status: { id: 'slow', value: 1, duration: 1 }, log: 'Roots tangle for a step.' },
  armor_break:   { kind: 'def', delta: 1, log: 'Grit works under your greaves.' },
  heat_fatigue:  { kind: 'damage', amount: 1, minHp: 5, log: 'Heat rises through the flagstones.' },
  echo_clone:    { kind: 'echo', amount: 1, minHp: 4, status: { id: 'slow', value: 1, duration: 1 }, log: 'Your echo strikes a half-beat late.' },
  flood_slow:    { kind: 'status', status: { id: 'slow', value: 1, duration: 1 }, log: 'Water sucks at your stride.' },
  void_vision:   { kind: 'torch', delta: -1, log: 'The void drinks a little more light.' }
};

export const PRESSURE_TINT = {
  torch_drain:   'rgba(70, 90, 120, 0.22)',
  bleed_tiles:   'rgba(140, 60, 50, 0.20)',
  slow_tiles:    'rgba(120, 160, 220, 0.20)',
  lava_pressure: 'rgba(200, 90, 40, 0.22)',
  root_snare:    'rgba(70, 110, 60, 0.20)',
  armor_break:   'rgba(120, 110, 90, 0.18)',
  heat_fatigue:  'rgba(180, 120, 50, 0.20)',
  echo_clone:    'rgba(140, 120, 180, 0.18)',
  flood_slow:    'rgba(60, 100, 140, 0.20)',
  void_vision:   'rgba(40, 20, 60, 0.24)'
};

/**
 * How many pressure tiles to stamp for a floor mechanic.
 * @param {string} mechanic
 * @param {number} floorIndex
 * @param {{ depthRemix?:boolean }} [opts]
 */
export function pressureTileCount(mechanic, floorIndex, opts = {}) {
  if (!mechanic || !PRESSURE_STEP[mechanic]) return 0;
  const base = 3 + Math.floor(Math.max(0, floorIndex) / 20);
  return opts.depthRemix ? base + 2 : base;
}

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
 * Soft effect when the player steps onto a biome pressure tile.
 * Cooldown: once every 3 turns globally so it stays readable.
 */
export function applyBiomePressureStep(player, tile, bus) {
  if (!player || player.isDead || !tile?.pressure?.mechanic) return false;
  const mechanic = tile.pressure.mechanic;
  const fx = PRESSURE_STEP[mechanic];
  if (!fx) return false;

  const turn = player.runStats?.turnsUsed || 0;
  if (player._lastPressureTurn != null && turn - player._lastPressureTurn < 3) {
    return false;
  }
  player._lastPressureTurn = turn;

  switch (fx.kind) {
    case 'damage':
      if (player.stats.hp > (fx.minHp || 3)) {
        player.takeDamage(fx.amount || 1);
        log(bus, fx.log);
      }
      break;
    case 'status':
      if (fx.status) {
        player.applyStatus(fx.status);
        log(bus, fx.log);
      }
      break;
    case 'torch':
      ensureFloorMods(player);
      player.floorModifiers.torchBonus = Math.max(
        -2,
        (player.floorModifiers.torchBonus || 0) + (fx.delta || -1)
      );
      log(bus, fx.log);
      break;
    case 'def':
      ensureFloorMods(player);
      player.floorModifiers.defPenalty = Math.min(
        2,
        (player.floorModifiers.defPenalty || 0) + (fx.delta || 1)
      );
      log(bus, fx.log);
      break;
    case 'echo':
      if (player.stats.hp > (fx.minHp || 3)) {
        player.takeDamage(fx.amount || 1);
      }
      if (fx.status) player.applyStatus(fx.status);
      log(bus, fx.log);
      bus?.emit?.('biome:echo', { mechanic: 'echo_clone' });
      break;
    default:
      if (fx.log) log(bus, fx.log);
      break;
  }
  return true;
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
  applyMechanicPulse(player, mechanic, pulse, bus);

  // Depth remix act 2: secondary donor mechanic on a staggered pulse.
  const secondary = floor.definition?.secondaryMechanic;
  if (secondary && secondary !== mechanic) {
    const pulse2 = turn > 0 && turn % 7 === 0;
    applyMechanicPulse(player, secondary, pulse2, bus);
  }
}

function applyMechanicPulse(player, mechanic, pulse, bus) {
  if (!mechanic || !pulse) return;
  switch (mechanic) {
    case 'torch_drain':
      ensureFloorMods(player);
      player.floorModifiers.torchBonus = Math.max(
        -1,
        (player.floorModifiers.torchBonus || 0) - 1
      );
      log(bus, 'Your torch sputters in the crypt air.');
      break;

    case 'bleed_tiles':
      if (player.stats.hp > 3) {
        player.takeDamage(1);
        log(bus, 'Bone dust draws a thin line of blood.');
      }
      break;

    case 'slow_tiles':
      player.applyStatus({ id: 'slow', value: 1, duration: 1 });
      log(bus, 'Frost bites your stride.');
      break;

    case 'lava_pressure':
      if (player.stats.hp > 4) {
        player.takeDamage(1);
        log(bus, 'Foundry heat sears your lungs.');
      }
      break;

    case 'root_snare':
      player.applyStatus({ id: 'slow', value: 1, duration: 1 });
      log(bus, 'A root catches your heel — then slips away.');
      break;

    case 'armor_break':
      ensureFloorMods(player);
      player.floorModifiers.defPenalty = Math.min(
        1,
        (player.floorModifiers.defPenalty || 0) + 1
      );
      log(bus, 'Grit works into the seams of your armor.');
      break;

    case 'heat_fatigue':
      if (player.stats.hp > 4) {
        player.takeDamage(1);
        log(bus, 'Heat-fatigue settles into your bones.');
      }
      break;

    case 'echo_clone':
      if (player.stats.hp > 4) player.takeDamage(1);
      player.applyStatus({ id: 'slow', value: 1, duration: 1 });
      log(bus, 'An echo of yourself answers — and strikes.');
      bus?.emit?.('biome:echo', { mechanic: 'echo_clone', pulse: true });
      break;

    case 'flood_slow':
      player.applyStatus({ id: 'slow', value: 1, duration: 1 });
      log(bus, 'Cold water pulls at your steps.');
      break;

    case 'void_vision':
      ensureFloorMods(player);
      player.floorModifiers.torchBonus = Math.max(
        -2,
        (player.floorModifiers.torchBonus || 0) - 1
      );
      log(bus, 'The void narrows what you can see.');
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

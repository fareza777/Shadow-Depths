/**
 * Runtime helpers for floor micro-events — used by GameScene.
 */
import {
  SHRINE_OPTIONS, MERCHANT_WARES, ALTAR_OPTIONS, LORE_OMENS,
  interactKey, tileInRoom, roomKey, addFloorMod
} from './floorEvents.js';
import { HAZARDS, hazardDamage } from './hazards.js';
import { StatusEffects } from '../combat/StatusEffects.js';
import { eventPanelTitle } from '../ui/FloorEventPanel.js';
import { identify } from '../items/Identification.js';
import { rollItemAffixes } from '../items/itemGenerator.js';

export function findInteractAt(floor, x, y) {
  const t = floor?.tileAt(x, y);
  if (t?.interact && !t.interact.used) return { tile: t, x, y };
  return null;
}

/** Shrine / merchant on tiles next to the player (not underfoot). */
export function findAdjacentInteract(floor, px, py) {
  if (!floor) return null;
  const candidates = [
    { x: px + 1, y: py }, { x: px - 1, y: py },
    { x: px, y: py + 1 }, { x: px, y: py - 1 }
  ];
  for (const c of candidates) {
    const hit = findInteractAt(floor, c.x, c.y);
    if (hit) return hit;
  }
  return null;
}

/** Nearest interact for UI hints — feet first, then adjacent. */
export function findInteractTarget(floor, px, py) {
  return findInteractAt(floor, px, py) || findAdjacentInteract(floor, px, py);
}

export function buildEventPanelConfig(kind, interact, ctx) {
  const title = interact?.label || eventPanelTitle(kind);
  switch (kind) {
    case 'shrine':
      return {
        title: eventPanelTitle('shrine'),
        subtitle: 'Pick one trade-off',
        options: SHRINE_OPTIONS.map((o) => ({
          id: o.id, label: o.label, detail: o.detail, enabled: true
        })),
        onPick: (id) => applyShrine(id, ctx)
      };
    case 'merchant': {
      const floorNum = (ctx.floor?.definition?.index ?? 0) + 1;
      return {
        title: 'Wandering Merchant',
        subtitle: `Gold: ${ctx.player.gold}`,
        options: MERCHANT_WARES.map((w) => {
          const locked = (w.floorMin ?? 1) > floorNum || !ctx.itemDefs?.[w.id];
          const afford = ctx.player.gold >= w.cost;
          return {
            id: w.id,
            label: `${w.label} — ${w.cost}g`,
            detail: locked ? 'Too deep for this stock' : afford ? 'Purchase' : 'Not enough gold',
            enabled: !locked && afford
          };
        }),
        onPick: (id) => buyMerchant(id, ctx)
      };
    }
    case 'altar_sacrifice':
      return {
        title: eventPanelTitle('altar_sacrifice'),
        subtitle: 'One trade — one floor boon',
        options: ALTAR_OPTIONS.map((o) => ({
          id: o.id, label: o.label, detail: o.detail,
          enabled: o.canApply(ctx.player)
        })),
        onPick: (id) => applyAltar(id, ctx)
      };
    case 'lore_omen':
      return buildLorePanel(interact, ctx);
  }
  return null;
}

function buildLorePanel(interact, ctx) {
  const omenId = interact?.omenId;
  if (omenId === 'hazard_warning') {
    return {
      title: eventPanelTitle('lore_omen'),
      subtitle: 'The air here bites.',
      options: [{ id: 'ok', label: 'Understood', detail: 'Hazard zone ahead.', enabled: true }],
      onPick: () => ctx.bus.emit('floor:event', { message: 'You tread carefully.' })
    };
  }
  const omen = LORE_OMENS.find((o) => o.id === omenId) || LORE_OMENS[0];
  return {
    title: eventPanelTitle('lore_omen'),
    subtitle: 'Words are carved into the stone',
    options: [{ id: omen.id, label: omen.label, detail: omen.detail, enabled: true }],
    onPick: (id) => {
      const pick = LORE_OMENS.find((o) => o.id === id) || omen;
      pick.apply(ctx.player, ctx);
      ctx.bus.emit('floor:event', { message: pick.detail });
    }
  };
}

function applyShrine(id, ctx) {
  const opt = SHRINE_OPTIONS.find((o) => o.id === id);
  if (!opt) return;
  opt.apply(ctx.player, ctx);
  ctx.bus.emit('floor:event', { message: opt.label });
}

function buyMerchant(id, ctx) {
  const ware = MERCHANT_WARES.find((w) => w.id === id);
  const floorNum = (ctx.floor?.definition?.index ?? 0) + 1;
  if (!ware || ctx.player.gold < ware.cost) return;
  if ((ware.floorMin ?? 1) > floorNum) return;
  if (!ctx.itemDefs?.[ware.id]) return;
  ctx.player.gold -= ware.cost;
  const item = ctx.itemFactory.create(ware.id, 1);
  if (item && ctx.player.inventory.add(item)) {
    ctx.bus.emit('item:pickedUp', { item, by: ctx.player });
    ctx.bus.emit('floor:event', { message: `Bought ${ware.label}.` });
  } else {
    ctx.player.gold += ware.cost;
    ctx.bus.emit('inventory:full');
  }
}

function applyAltar(id, ctx) {
  const opt = ALTAR_OPTIONS.find((o) => o.id === id);
  if (!opt || !opt.canApply(ctx.player)) return;
  opt.apply(ctx.player, ctx);
  ctx.bus.emit('floor:event', { message: opt.label });
}

export function applyRestAlcove(player, bus) {
  const missing = player.stats.hpMax - player.stats.hp;
  const healed = player.heal(Math.ceil(missing * 0.3));
  player.restoreRangedFocus?.(1);
  bus.emit('entity:healed', { entity: player, amount: healed, source: 'rest_alcove' });
  bus.emit('floor:event', { message: 'You rest by the alcove.' });
}

export function applyMysteryChest(ctx) {
  const { player, floor, itemFactory, rng, bus, meta } = ctx;
  const floorNum = (floor.definition?.index ?? 0) + 1;
  const pool = Object.values(ctx.itemDefs).filter((d) => {
    if (d.type === 'material') return false;
    return (d.floorMin ?? 1) <= floorNum;
  });
  if (!pool.length) return;
  const def = rng.pick(pool);
  const affixes = def.slot ? rollItemAffixes(def, floorNum, rng) : null;
  const item = affixes
    ? itemFactory.createWithAffix(def.id, affixes, 1)
    : itemFactory.create(def.id, 1);
  if (!item) return;
  if (rng.chance(0.45)) {
    addFloorMod(player, { defPenalty: 1 });
    player.floorCurse = { defPenalty: 1 };
    bus.emit('floor:event', { message: 'The chest was cursed! −1 DEF this floor.' });
  } else {
    bus.emit('floor:event', { message: 'The chest yields its treasure.' });
  }
  if (player.inventory.add(item)) {
    bus.emit('item:pickedUp', { item, by: player });
    if (item.def && meta) identify(item.id, meta);
  } else {
    const spot = { x: player.x, y: player.y };
    floor.addItem(spot.x, spot.y, item);
    bus.emit('floor:event', { message: 'Your pack is full — it falls at your feet.' });
  }
}

export function tryTriggerAmbush(scene) {
  const floor = scene.floor;
  const events = floor?.microEvents?.length ? floor.microEvents : (floor?.microEvent ? [floor.microEvent] : []);
  const me = events.find((e) => e.ambushRoomKey && !e.used?.ambush);
  if (!me) return;
  const room = floor.rooms.find((r) => roomKey(r) === me.ambushRoomKey);
  if (!room || !tileInRoom(scene.player.x, scene.player.y, room)) return;
  me.used.ambush = true;
  const defs = me.ambushDefs || [];
  const reserved = new Set();
  for (const e of floor.enemies()) reserved.add(`${e.x},${e.y}`);
  reserved.add(`${scene.player.x},${scene.player.y}`);
  let spawned = 0;
  for (const defId of defs) {
    const pos = randomFreeInRoom(floor, room, reserved, scene.rng);
    if (!pos) continue;
    const enemy = scene._createEnemy(defId, pos, floor);
    if (enemy) {
      floor.addEntity(enemy);
      reserved.add(`${pos.x},${pos.y}`);
      spawned++;
    }
  }
  if (spawned > 0) {
    scene.bus.emit('floor:event', { message: 'Ambush! Enemies spring from the shadows.' });
  }
}

function randomFreeInRoom(floor, room, reserved, rng) {
  for (let i = 0; i < 30; i++) {
    const x = rng.randInt(room.x + 1, room.x + room.w - 2);
    const y = rng.randInt(room.y + 1, room.y + room.h - 2);
    const key = `${x},${y}`;
    if (reserved.has(key)) continue;
    if (!floor.isPassable(x, y) || floor.entityAt(x, y)) continue;
    return { x, y };
  }
  return null;
}

export function tickAmbientHazard(scene) {
  const t = scene.floor?.tileAt(scene.player.x, scene.player.y);
  const amb = t?.ambient;
  if (!amb || scene.player.isDead) return;
  const turn = scene.player.runStats.turnsUsed;
  if (turn % 3 !== 0) return;
  const depth = scene.floor.definition?.index ?? 0;
  const base = scene.balance.dungeon?.hazardBaseDamage ?? 4;
  const meta = HAZARDS[amb.type] || HAZARDS.spike;
  const dealt = scene.player.takeDamage(hazardDamage(amb.type, depth, base));
  scene.bus.emit('entity:damaged', {
    entity: scene.player, amount: dealt,
    source: { name: meta.label, kind: 'hazard' }, isCrit: false
  });
  if (meta.status && !scene.player.isDead) {
    StatusEffects.apply(scene.player, meta.status, scene.bus);
  }
  if (scene.player.isDead) {
    scene.player.runStats.killedBy = meta.label;
    scene.bus.emit('entity:died', { entity: scene.player, killer: { name: meta.label } });
  } else {
    scene.bus.emit('floor:event', { message: `${meta.label} — the zone sears you.` });
  }
}

export function revealRandomRoom(floor) {
  const rooms = floor.rooms || [];
  if (!rooms.length) return;
  const room = rooms[Math.floor(Math.random() * rooms.length)];
  let changed = false;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      const t = floor.tileAt(x, y);
      if (t && !t.explored) {
        t.explored = true;
        changed = true;
      }
    }
  }
  if (changed) floor.touchRender?.();
}

export function markInteractUsed(floor, x, y) {
  const t = floor.tileAt(x, y);
  if (!t?.interact) return;
  t.interact.used = true;
  floor.touchRender?.();
  const key = interactKey(x, y);
  const list = floor.microEvents?.length ? floor.microEvents : (floor.microEvent ? [floor.microEvent] : []);
  const evt = list.find((e) => e.interactPos?.x === x && e.interactPos?.y === y) || list[0];
  if (evt?.used) evt.used[key] = true;
}

export function serializeEventTiles(floor) {
  const tiles = [];
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const t = floor.tiles[y][x];
      if (!t.interact && !t.ambient && !t.hazard && !t.door && !t.secret) continue;
      const entry = { x, y };
      if (t.interact) entry.interact = { ...t.interact };
      if (t.ambient) entry.ambient = { ...t.ambient };
      // A door the player already paid a key for must not re-lock on reload:
      // the floor is rebuilt from its seed and the key is long spent.
      if (t.door) entry.door = { ...t.door };
      if (t.secret) entry.secret = { ...t.secret };
      if (t.hazard) {
        entry.hazard = {
          type: t.hazard.type,
          armed: t.hazard.armed,
          revealed: t.hazard.revealed
        };
      }
      tiles.push(entry);
    }
  }
  return tiles;
}

export function restoreEventTiles(floor, tiles = []) {
  for (const e of tiles) {
    const t = floor.tileAt(e.x, e.y);
    if (!t) continue;
    if (e.interact) t.interact = { ...e.interact };
    if (e.ambient) t.ambient = { ...e.ambient };
    if (e.hazard) t.hazard = { ...e.hazard };
    if (e.door) t.door = { ...e.door };
    if (e.secret) t.secret = { ...e.secret };
  }
}

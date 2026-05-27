/**
 * GameScene — in-game scene. Owns the turn engine + active dungeon.
 *
 * Lives in src/core/ because it's orchestration glue (it ties together
 * CombatSystem, Dungeon, Renderer, HUD) rather than UI or world data. The
 * brief lists scenes loosely; I picked core over a new src/scenes/ folder
 * to avoid expanding the mandated structure.
 *
 * Turn order (Section 7.1 of the brief):
 *   1. Player action validated + executed.
 *   2. Player status effects tick.
 *   3. Each enemy decides + acts (closest-first).
 *   4. Enemy status effects tick.
 *   5. Lighting recomputed; render next frame.
 *
 * Per-frame work is delegated to Renderer + ParticleSystem; this scene does
 * no per-tick simulation. Update() is empty by design.
 */
import {
  TILE, TILE_SIZE, LOG, COLOR, FONT_DISPLAY, FONT_BODY, FONT_MONO, uiSize
} from '../config/constants.js';
import { Layout } from '../config/layoutMetrics.js';
import { Player } from '../entities/Player.js';
import { heroDef } from '../rendering/heroSprites.js';
import { HERO_SPELLS } from '../config/heroSpells.js';
import { craft, getRecipe } from '../items/Crafting.js';
import { identify, isIdentified } from '../items/Identification.js';

/** Per-hero stat overrides (atk/def/dex/torchRadius) for new Player(). */
function heroStatOverrides(kind) {
  const def = heroDef(kind);
  return def ? { ...def.stats } : null;
}
import { Enemy } from '../entities/Enemy.js';
import { Inventory } from '../items/Inventory.js';
import { ItemFactory } from '../items/ItemFactory.js';
import { Equipment } from '../items/Equipment.js';
import { findQuickUseSlots } from '../items/quickUse.js';
import { Dungeon } from '../world/Dungeon.js';
import { Pathfinding } from '../world/Pathfinding.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { RNG } from './RNG.js';
import { MobileControls } from '../ui/MobileControls.js';
import { QuickUseBar } from '../ui/QuickUseBar.js';

import { ChaseBehavior } from '../entities/behaviors/ChaseBehavior.js';
import { RangedBehavior, hasLineOfSight } from '../entities/behaviors/RangedBehavior.js';
import { ErraticBehavior } from '../entities/behaviors/ErraticBehavior.js';
import { HeavyBehavior } from '../entities/behaviors/HeavyBehavior.js';
import { PhaseBehavior } from '../entities/behaviors/PhaseBehavior.js';

const BEHAVIORS = {
  chase: ChaseBehavior,
  ranged: RangedBehavior,
  erratic: ErraticBehavior,
  heavy: HeavyBehavior,
  phase: PhaseBehavior
};

export class GameScene {
  /**
   * @param {{
   *   bus:object, state:object, content:object, balance:object,
   *   hud:object, minimap:object, inventoryUI:object, lighting:object,
   *   seed?:number
   * }} deps
   */
  constructor(deps) {
    this.bus = deps.bus;
    this.state = deps.state;
    this.content = deps.content;
    this.balance = deps.balance;
    this.hud = deps.hud;
    this.minimap = deps.minimap;
    this.inventoryUI = deps.inventoryUI;
    this.skillPicker = deps.skillPicker || null;
    this.vigil = deps.vigilScreen || null;
    this.controls = deps.mobileControls || new MobileControls({ bus: this.bus });
    this.quickUse = deps.quickUseBar || new QuickUseBar({ bus: this.bus });
    this.pause = deps.pauseOverlay || null;
    this.crafting = deps.craftingPanel || null;
    this.tutorial = deps.tutorial || null;
    this.lighting = deps.lighting;
    this.renderer = deps.renderer || null; // optional; used for tap→tile
    this.save = deps.saveManager || null;
    this.resumeSnapshot = deps.resumeSnapshot || null;

    this.seed = this.resumeSnapshot?.seed ?? deps.seed ?? RNG.newSeed();
    this.mode = this.resumeSnapshot?.mode || deps.mode || 'normal'; // 'normal' | 'daily'
    this.heroKind = this.resumeSnapshot?.heroKind || deps.heroKind || 'vigil';
    this.rng = new RNG(this.seed, 'run');
    this.pathfinding = new Pathfinding();
    this.combat = new CombatSystem({
      bus: this.bus, balance: this.balance,
      rng: this.rng, pathfinding: this.pathfinding
    });

    this.itemFactory = new ItemFactory(this.content.items);
    this.dungeon = new Dungeon({
      balance: this.balance, rng: this.rng, content: this.content
    });

    this.player = null;
    this.floor = null;
    this._floorBanner = null;
    this._lootToast = null;
    this._processingTurn = false;
    this._busHandlers = [];
    this._wireCommands();
    this._wireDeathCleanup();
    this._wirePresentationEvents();
    this._wireCraftingEvents();
    this._wireIdentification();
  }

  exit() {
    for (const { event, fn } of this._busHandlers) {
      this.bus.off(event, fn);
    }
    this._busHandlers.length = 0;
    this._processingTurn = false;
  }

  // --- scene contract -------------------------------------------------
  enter(_opts) {
    this._resetBlockingUI();
    this._processingTurn = false;
    if (this.resumeSnapshot) {
      this._enterFromSnapshot(this.resumeSnapshot);
      this.resumeSnapshot = null;
      return;
    }
    const inv = new Inventory(this.balance.player.inventorySlots);
    const { floor, spawns } = this.dungeon.getOrGenerate(0);
    this.player = new Player(this.balance, spawns.player, inv, { heroKind: this.heroKind, heroOverrides: heroStatOverrides(this.heroKind) });
    this.player.snapRender();
    floor.addEntity(this.player);

    this._spawnFloorEntities(floor, spawns);
    this._applyStarterLoadout();
    this._applyMetaUnlocks();

    this.floor = floor;
    this.lighting.compute(this.floor, this.player, this.player.torchRadius);
    this.state.setRun({ seed: this.seed, floorIndex: 0, mode: this.mode });
    this._emitFloorEntered(0, floor);
    this._saveRun();
    if (this.tutorial && this.state.state.meta?.settings?.showTutorial !== false) {
      this.tutorial.show(true);
    }
  }

  _enterFromSnapshot(snapshot) {
    const floorIndex = Math.max(0, Math.min(this.dungeon.totalFloors - 1, snapshot.floorIndex || 0));
    for (let i = 0; i <= floorIndex; i++) this.dungeon.getOrGenerate(i);
    this.dungeon.currentIndex = floorIndex;
    const { floor, spawns } = this.dungeon.current();
    this.itemFactory = new ItemFactory(this.content.items);
    this._restoreFloorSnapshot(floor, snapshot.floor);

    const inv = new Inventory(snapshot.player?.inventorySize || this.balance.player.inventorySlots);
    inv.loadSnapshot(snapshot.player?.inventory || [], this.itemFactory);
    this.player = new Player(this.balance, snapshot.player?.pos || spawns.player, inv, {
      heroKind: this.heroKind,
      heroOverrides: heroStatOverrides(this.heroKind)
    });
    this._restorePlayerSnapshot(this.player, snapshot.player || {});
    this.player.snapRender();
    floor.addEntity(this.player);

    this.floor = floor;
    this.pathfinding.invalidate();
    this.lighting.compute(this.floor, this.player, this.player.torchRadius);
    this.state.setRun({
      seed: this.seed,
      floorIndex,
      mode: this.mode,
      canContinue: true,
      level: this.player.level,
      hp: this.player.stats.hp,
      savedAt: snapshot.savedAt || Date.now()
    });
    this._emitFloorEntered(floorIndex, floor);
    this._saveRun();
  }

  /** Close singleton modals so a new run cannot inherit a soft-lock. */
  _resetBlockingUI() {
    this.skillPicker?.hide();
    this.pause?.hide();
    this.inventoryUI?.hide();
    this.vigil?.hide();
  }

  _emitFloorEntered(index, floor) {
    const def = floor?.definition || {};
    this._floorBanner = this._buildFloorBanner(index, def);
    // Rest floors fully heal the player on entry — incentive to push deeper.
    if (def.type === 'rest' && this.player && !this.player.isDead) {
      const before = this.player.stats.hp;
      this.player.stats.hp = this.player.stats.hpMax;
      const restored = this.player.stats.hp - before;
      if (restored > 0) {
        this.bus.emit('entity:healed', { entity: this.player, amount: restored, source: 'rest_floor' });
      }
    }
    this.bus.emit('floor:entered', {
      index,
      name: def.name,
      biomeId: def.biomeId || null,
      specialEnemyId: def.specialEnemyId || null,
      type: def.type || null,
      floorNumber: index + 1
    });
  }

  _wirePresentationEvents() {
    this._listen('item:pickedUp', ({ item }) => {
      if (!item) return;
      this._lootToast = {
        item,
        startedAt: performance.now(),
        duration: 2100
      };
    });
    this._listen('entity:died', ({ entity }) => {
      const id = entity?.defId || '';
      if (!id.startsWith('boss_') && !id.startsWith('subboss_')) return;
      const boss = id.startsWith('boss_');
      this._floorBanner = {
        startedAt: performance.now(),
        duration: boss ? 3400 : 2600,
        title: boss ? 'BOSS VANQUISHED' : 'GUARDIAN BROKEN',
        name: entity.name || 'The Depths Recoil',
        subtitle: boss
          ? 'The seal cracks. The way below answers.'
          : 'The lesser seal falls silent.',
        accent: boss ? COLOR.goldHi : '#c080ff',
        boss,
        subboss: !boss,
        victory: true
      };
    });
  }

  update(_dt) { /* turn-based; no per-frame logic */ }

  render(renderer) {
    this.renderWorld(renderer);
    this.renderUI(renderer);
  }

  renderWorld(renderer) {
    if (!this.floor || !this.player) return;
    if (!this.renderer) this.renderer = renderer;
    renderer.setCameraFor(this.player.renderX, this.player.renderY);
    renderer.drawFloor(this.floor, this.player);
    renderer.drawGroundItems(this.floor);
    renderer.drawTelegraphs(this.floor, this.player);
    const now = performance.now();
    const dt = this._lastRenderTime ? (now - this._lastRenderTime) / 1000 : 0;
    this._lastRenderTime = now;
    renderer.drawEntities(this.floor, dt, this.player);
  }

  renderUI(renderer) {
    if (!this.floor || !this.player) return;
    if (!this.renderer) this.renderer = renderer;
    if (!this.controls) this.controls = new MobileControls({ bus: this.bus });
    if (!this.quickUse) this.quickUse = new QuickUseBar({ bus: this.bus });

    try {
      this.hud.render(renderer, {
        player: this.player, floor: this.floor,
        floorIndex: this.dungeon.currentIndex,
        totalFloors: this.dungeon.totalFloors,
        mode: this.mode,
        suppressMessages: !!this._floorBanner
      });
    } catch (err) {
      console.error(LOG.CORE, 'HUD render failed:', err);
    }

    if (this.controls) {
      // Tell the iron HUD what's actionable this frame so AIM / DOWN /
      // PICK render in their "ready" state (ember glow) vs disabled.
      const stairs = this.floor && this.player &&
        this.floor.tileAt &&
        this.floor.tileAt(this.player.x, this.player.y);
      const canDescend = !!(stairs && typeof stairs.isStairsDown === 'function'
        ? stairs.isStairsDown()
        : stairs && stairs.type === 4 /* TILE.STAIRS_DOWN */);
      const itemsHere = (this.floor?.itemsAt &&
        this.floor.itemsAt(this.player.x, this.player.y)) || [];
      const aimTarget = MobileControls.computeAimTarget(this.player, this.floor);
      const spellState = this._spellState();
      this.controls.setContext({
        aimTarget,
        castReady: spellState.ready,
        spell: spellState,
        canDescend,
        pickAvailable: itemsHere.length > 0
      });
      if (this.quickUse) {
        this.quickUse.setContext({
          pickAvailable: itemsHere.length > 0
        });
      }
      this.controls.renderBackground(renderer);
      this._renderControlBandContent(renderer);
      this.controls.renderControls(renderer);
    }

    this._renderBossBar(renderer);
    this._renderLootToast(renderer);
    this._renderDangerVignette(renderer);
    this._renderFloorBanner(renderer);
    this.inventoryUI.render(renderer, this.player);
    if (this.vigil) this.vigil.render(renderer, this.player);
    if (this.skillPicker) this.skillPicker.render(renderer);
    if (this.pause) this.pause.render(renderer);
    if (this.crafting) this.crafting.render(renderer);
    if (this.tutorial?.open) this.tutorial.render(renderer);
  }

  _buildFloorBanner(index, def) {
    const specialId = def.specialEnemyId || null;
    const special = specialId ? this.content.enemies?.[specialId] : null;
    const isBoss = specialId?.startsWith('boss_');
    const isSubboss = specialId?.startsWith('subboss_');
    return {
      startedAt: performance.now(),
      duration: isBoss ? 5200 : isSubboss ? 4400 : 3600,
      title: isBoss ? 'BOSS FLOOR'
        : isSubboss ? 'SUBBOSS FLOOR'
        : `FLOOR ${index + 1}`,
      name: isBoss || isSubboss ? (special?.name || def.name) : def.name,
      subtitle: isBoss ? 'The dungeon seals behind you. Defeat the ruler below.'
        : isSubboss ? 'An elite guardian is awake. The path narrows.'
        : (def.atmosphere || `Depth ${index + 1} of ${this.dungeon.totalFloors}`),
      accent: isBoss ? '#d4be7a' : isSubboss ? '#c080ff' : COLOR.goldDim,
      boss: isBoss,
      subboss: isSubboss
    };
  }

  _renderFloorBanner(r) {
    if (!this._floorBanner) return;
    const b = this._floorBanner;
    const age = performance.now() - b.startedAt;
    if (age > b.duration) {
      this._floorBanner = null;
      return;
    }
    const fadeIn = Math.min(1, age / 260);
    const fadeOut = Math.min(1, (b.duration - age) / 480);
    const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
    const ctx = r.ctx;
    const w = b.boss ? Layout.canvasW - 34 : Layout.canvasW - 74;
    const h = b.boss ? 94 : 76;
    const x = (Layout.canvasW - w) / 2;
    const y = Layout.hud + 18;
    ctx.save();
    ctx.globalAlpha = alpha;
    r.drawRect(x - 6, y - 6, w + 12, h + 12, '#050308dd');
    r.drawRect(x, y, w, h, '#1d1724ee');
    r.drawStrokedRect(x, y, w, h, b.accent, b.boss ? 3 : 2);
    r.drawRect(x + 6, y + 6, w - 12, 2, '#ffffff1a');
    r.drawText(b.title, Layout.canvasW / 2, y + 12, {
      size: uiSize(10), bold: true, align: 'center',
      family: FONT_MONO, color: b.accent
    });
    this._drawFittedBannerText(r, b.name, Layout.canvasW / 2, y + 31, w - 34, {
      size: uiSize(b.boss ? 18 : 15), minSize: uiSize(12), bold: true,
      align: 'center', family: FONT_DISPLAY, color: b.boss ? COLOR.goldHi : COLOR.gold
    });
    this._drawFittedBannerText(r, b.subtitle, Layout.canvasW / 2, y + h - 22, w - 34, {
      size: uiSize(11), minSize: uiSize(8), align: 'center',
      family: FONT_BODY, color: COLOR.textMuted
    });
    if (b.boss || b.subboss) {
      const pulse = 0.55 + Math.sin(age * 0.012) * 0.25;
      ctx.globalAlpha = alpha * pulse;
      ctx.strokeStyle = b.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 18, y + h / 2);
      ctx.lineTo(x + 48, y + h / 2);
      ctx.moveTo(x + w - 18, y + h / 2);
      ctx.lineTo(x + w - 48, y + h / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderBossBar(r) {
    const boss = this.floor?.enemies?.().find((e) =>
      !e.isDead && (e.defId?.startsWith('boss_') || e.defId?.startsWith('subboss_')));
    if (!boss || this._floorBanner) return;
    const isBoss = boss.defId.startsWith('boss_');
    const w = isBoss ? Layout.canvasW - 56 : Layout.canvasW - 96;
    const h = isBoss ? 25 : 20;
    const x = (Layout.canvasW - w) / 2;
    const y = Layout.hud + 8;
    const pct = Math.max(0, Math.min(1, boss.stats.hp / boss.stats.hpMax));
    const accent = isBoss ? COLOR.gold : '#c080ff';
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = 0.92;
    r.drawRect(x - 4, y - 4, w + 8, h + 8, '#050307dd');
    r.drawRect(x, y, w, h, '#1b1420ee');
    r.drawStrokedRect(x, y, w, h, accent, isBoss ? 2 : 1);
    r.drawRect(x + 3, y + h - 8, w - 6, 5, '#2a1018');
    r.drawRect(x + 3, y + h - 8, (w - 6) * pct, 5, isBoss ? '#b84a3c' : '#8a60d0');
    r.drawText(isBoss ? 'BOSS' : 'ELITE', x + 9, y + 5, {
      size: uiSize(8), bold: true, family: FONT_MONO, color: accent
    });
    r.drawText(boss.name || boss.defId, x + w / 2, y + 4, {
      size: uiSize(isBoss ? 11 : 10), bold: true, align: 'center',
      family: FONT_DISPLAY, color: COLOR.textPrimary
    });
    r.drawText(`${boss.stats.hp}/${boss.stats.hpMax}`, x + w - 8, y + 5, {
      size: uiSize(8), bold: true, align: 'right', family: FONT_MONO, color: COLOR.textMuted
    });
    ctx.restore();
  }

  _renderLootToast(r) {
    if (!this._lootToast) return;
    const age = performance.now() - this._lootToast.startedAt;
    if (age > this._lootToast.duration) {
      this._lootToast = null;
      return;
    }
    const item = this._lootToast.item;
    const alpha = Math.min(1, age / 180, (this._lootToast.duration - age) / 260);
    const y = Math.round(Layout.hud + 26 + Math.sin(age * 0.006) * 2);
    const w = Math.min(Layout.canvasW - 44, 330);
    const h = 62;
    const x = (Layout.canvasW - w) / 2;
    const rarity = GameScene._rarityColor(item.rarity);
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    r.drawRect(x - 4, y - 4, w + 8, h + 8, '#050307cc');
    r.drawRect(x, y, w, h, '#231c2aee');
    r.drawStrokedRect(x, y, w, h, rarity, 2);
    r.drawRect(x + 7, y + 7, 48, 48, '#100c16');
    r.drawStrokedRect(x + 7, y + 7, 48, 48, COLOR.borderSoft, 1);
    if (r.sprites) r.sprites.draw(item.spriteKey, r.ctx, x + 11, y + 11, { size: 40 });
    r.drawText('RELIC FOUND', x + 66, y + 8, {
      size: uiSize(8), bold: true, family: FONT_MONO, color: rarity
    });
    this._drawFittedBannerText(r, item.name || item.id, x + 66, y + 22, w - 78, {
      size: uiSize(13), minSize: uiSize(9), bold: true,
      family: FONT_DISPLAY, color: COLOR.textPrimary
    });
    const hint = GameScene._itemStatLine(item) || (item.lore || '').replace(/[“”"]/g, '');
    this._drawFittedBannerText(r, hint, x + 66, y + 43, w - 78, {
      size: uiSize(9), minSize: uiSize(8), italic: true,
      family: FONT_BODY, color: COLOR.textMuted
    });
    ctx.restore();
  }

  _renderDangerVignette(r) {
    const hpPct = this.player?.stats?.hpMax ? this.player.stats.hp / this.player.stats.hpMax : 1;
    if (hpPct > 0.35) return;
    const pulse = 0.38 + Math.sin(performance.now() * 0.012) * 0.12;
    const alpha = (0.35 - hpPct) * 0.9 + pulse * 0.18;
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0.08, Math.min(0.34, alpha));
    ctx.strokeStyle = '#b83838';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, Layout.canvasW - 10, Layout.canvasH - 10);
    const g = ctx.createRadialGradient(
      Layout.canvasW / 2, Layout.canvasH / 2, Layout.canvasW * 0.24,
      Layout.canvasW / 2, Layout.canvasH / 2, Layout.canvasW * 0.76
    );
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, '#8a1010');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Layout.canvasW, Layout.canvasH);
    ctx.restore();
  }

  _drawFittedBannerText(r, text, x, y, maxW, opts) {
    let size = opts.size || uiSize(11);
    const minSize = opts.minSize || uiSize(8);
    while (size > minSize && r.measureText(text, { ...opts, size }) > maxW) {
      size -= 1;
    }
    r.drawText(text, x, y, { ...opts, size });
  }

  _renderControlBandContent(renderer) {
    try {
      this.minimap.render(renderer, { floor: this.floor, player: this.player });
    } catch (err) {
      console.error(LOG.CORE, 'minimap render failed:', err);
    }
    try {
      if (this.quickUse) this.quickUse.render(renderer, this.player);
    } catch (err) {
      console.error(LOG.CORE, 'quick-use render failed:', err);
    }
  }

  // --- input ----------------------------------------------------------
  handleInput(action) {
    if (!action || this.player.isDead) return;

    if (this.tutorial?.open) {
      const consumed = this.tutorial.handleInput(action);
      if (consumed) return;
    }

    // Crafting modal blocks all input below it.
    if (this.crafting?.open) {
      if (action.type === 'pointer') {
        if (this.crafting.handleTap(action.x, action.y)) return;
        return;
      }
      if (action.type === 'escape' || action.type === 'menu') {
        this.crafting.hide();
        return;
      }
    }

    if (this.pause?.open) {
      if (action.type === 'pointer') {
        const idx = this.pause.hitTest(action.x, action.y);
        if (idx >= 0) {
          this.pause.handleInput({ type: 'tap', buttonIndex: idx });
        }
        return;
      }
      if (this.pause.handleInput(action)) return;
    }

    // Skill picker modal takes highest priority — it pops on level-up and
    // must resolve before any other input.
    if (this.skillPicker?.open) {
      if (action.type === 'pointer') {
        this.skillPicker.handleCanvasTap(action.x, action.y);
        return;
      }
      if (this.skillPicker.handleInput(action)) return;
      return;
    }

    // Vigil (character) screen — full-canvas modal.
    if (this.vigil?.open) {
      if (action.type === 'pointer') {
        this.vigil.handleCanvasTap(action.x, action.y, this.player);
        return;
      }
      if (action.type === 'tapTile') return;
      if (this.vigil.handleInput(this.player, action)) return;
    }

    // Inventory modal — handle canvas taps first (mobile-critical), then
    // route every other semantic action through its handler. Both swallow.
    if (this.inventoryUI.open) {
      if (action.type === 'pointer') {
        this.inventoryUI.handleCanvasTap(action.x, action.y, this.player);
        return;
      }
      if (action.type === 'tapTile') return; // suppress tile interpretation
      if (this.inventoryUI.handleInput(this.player, action)) return;
    }

    switch (action.type) {
      case 'move':       return this._playerMove(action.dx, action.dy);
      case 'wait':       return this._endPlayerTurn(true);
      case 'pickup':     return this._playerPickup();
      case 'descend':    return this._playerDescend();
      case 'inventory':  return this.inventoryUI.toggle();
      case 'vigil':
        if (this.vigil) {
          if (this.vigil.open) this.vigil.hide();
          else {
            this.inventoryUI.hide();
            this.vigil.show();
          }
        }
        return;
      case 'menu':
        if (this.pause) this.pause.show();
        return;
      case 'aim':
        // Iron HUD AIM button: auto-attack nearest visible enemy in range.
        return this._playerAimAttack();
      case 'cast':
        return this._playerCastSpell();
      case 'minimap':    return this.minimap.toggle();
      case 'quickUse':   return this._playerQuickUse(action.index);
      case 'useSlot':    return this._playerUseSlot(action.index);
      case 'pointer': {
        // Canvas tap dispatch order:
        //   1. Control band buttons (D-pad / actions) — they're painted
        //      INSIDE the canvas now, so hit-tests are pixel-perfect.
        //   2. World viewport → tap-to-walk via Renderer.canvasToTile.
        //   3. HUD area taps fall through (no behavior).
        if (this.quickUse) {
          const quickHit = this.quickUse.hitTest(
            action.x, action.y, this.state.state.time, this.player?.inventory
          );
          if (typeof quickHit === 'number' && quickHit >= 0) {
            this._playerQuickUse(quickHit);
            return;
          }
          if (quickHit && typeof quickHit.type === 'string') {
            this.handleInput({ type: quickHit.type });
            return;
          }
        }
        if (this.controls && this.controls.handleTap(action.x, action.y, this.state.state.time)) return;
        if (!this.renderer) return;
        if (this._tryTapAttackAdjacent(action.x, action.y)) return;
        const tile = this.renderer.canvasToTile(action.x, action.y);
        if (!tile) return;
        return this._playerTapTile(tile.x, tile.y);
      }
      case 'tapTile':    return; // legacy; pointer is preferred
      case 'escape':
        if (this.inventoryUI.open) return this.inventoryUI.hide();
        if (this.vigil?.open) { this.vigil.hide(); return; }
        if (this.pause) { this.pause.toggle(); return; }
        return;
      default: break;
    }
  }

  /**
   * Subscribe to entity:died so dead enemies are removed from the floor
   * immediately. Without this they persisted in the spatial index and
   * blocked movement on their tile (the "invisible corpse" bug).
   */
  _listen(event, fn) {
    this.bus.on(event, fn);
    this._busHandlers.push({ event, fn });
  }

  _wireDeathCleanup() {
    this._listen('entity:died', ({ entity }) => {
      if (!this.floor) return;
      if (entity?.kind === 'enemy') {
        this._maybeDropMaterial(entity);
        this.floor.removeEntity(entity);
      }
    });
  }

  _wireIdentification() {
    const meta = this.state?.state?.meta;
    if (!meta) return;
    // Equipping or using an item auto-identifies its base id.
    const reveal = ({ item }) => {
      if (!item?.id) return;
      if (identify(item.id, meta)) {
        this.bus.emit('item:identified', { item });
      }
    };
    this._listen('item:used', reveal);
    this._listen('item:equipped', reveal);
  }

  _wireCraftingEvents() {
    this._listen('request:openCrafting', () => {
      if (this.crafting && this.player) {
        this.crafting.player = this.player;
        this.crafting.show();
      }
    });
    this._listen('craft:request', ({ recipeId }) => {
      if (!this.crafting || !this.player) return;
      const recipe = getRecipe(recipeId);
      if (!recipe) return;
      const result = craft(this.player, recipe, {
        itemDefs: this.content.items,
        rng: this.rng.fork('craft'),
        floorLevel: (this.dungeon?.currentIndex ?? 0) + 1
      });
      if (result.ok && result.item) {
        this.bus.emit('item:crafted', { item: result.item });
      }
    });
  }

  /**
   * ~12% chance per kill to drop a crafting material matching the current
   * biome. Materials live in the same item registry as everything else,
   * so the existing pickup path picks them up automatically.
   */
  _maybeDropMaterial(enemy) {
    if (!this.floor || !this.rng) return;
    if (!this.rng.fork('material').chance(0.12)) return;
    const biomeId = this.floor.definition?.biomeId;
    if (!biomeId) return;
    const candidates = Object.values(this.content.items).filter(
      (d) => d.type === 'material' && Array.isArray(d.biomes) && d.biomes.includes(biomeId)
    );
    if (candidates.length === 0) return;
    const matDef = this.rng.fork('material').pick(candidates);
    const item = this.itemFactory.create(matDef.id, 1);
    if (item) this.floor.addItem(enemy.x, enemy.y, item);
  }

  // --- player actions -------------------------------------------------
  _playerMove(dx, dy) {
    const nx = this.player.x + dx, ny = this.player.y + dy;
    const target = this.floor.entityAt(nx, ny);
    if (target && target.kind === 'enemy' && !target.isDead) {
      this._attackEnemyAt(nx, ny);
      return;
    }
    if (this.floor.isPassable(nx, ny)) {
      this.combat.execute({ type: 'move', to: { x: nx, y: ny } },
        this.player, { floor: this.floor, player: this.player });
      this._endPlayerTurn(true);
    }
  }

  _attackEnemyAt(tx, ty) {
    const ent = this.floor.entityAt(tx, ty);
    if (!ent || ent.kind !== 'enemy' || ent.isDead) return;
    this.combat.execute(
      { type: 'attack', target: { x: tx, y: ty } },
      this.player,
      { floor: this.floor, player: this.player }
    );
    this._endPlayerTurn(true);
  }

  /**
   * AIM button — execute a ranged attack against the nearest visible
   * enemy in range with line of sight. No-op if no valid target.
   */
  _playerAimAttack() {
    const target = MobileControls.computeAimTarget(this.player, this.floor);
    if (!target) return;
    const range = typeof this.player.effectiveRange === 'function'
      ? this.player.effectiveRange() : 1;
    if (range <= 1) {
      // No ranged weapon — fall back to melee if adjacent.
      const dist = Math.abs(target.x - this.player.x) + Math.abs(target.y - this.player.y);
      if (dist === 1) this._attackEnemyAt(target.x, target.y);
      return;
    }
    this.combat.execute(
      { type: 'ranged', target: { x: target.x, y: target.y } },
      this.player,
      { floor: this.floor, player: this.player }
    );
    this._endPlayerTurn(true);
  }

  _spellState() {
    const def = HERO_SPELLS[this.player?.heroKind || this.heroKind];
    if (!def || !this.player) return { ready: false, name: '', cooldown: 0 };
    const cooldown = Math.max(0, this.player.spellCooldown || 0);
    const needsTarget = ['hollow', 'inquisitor', 'reaver'].includes(this.player.heroKind);
    const target = this.player.heroKind === 'reaver'
      ? this._nearestVisibleEnemy(def.radius || 2, false)
      : needsTarget
        ? this._nearestVisibleEnemy(def.range || 6, this.player.heroKind === 'hollow')
        : null;
    return {
      ...def,
      baseCooldown: def.cooldown,
      cooldown,
      ready: cooldown <= 0 && (!needsTarget || !!target),
      target
    };
  }

  _playerCastSpell() {
    const state = this._spellState();
    if (!state.ready) return;
    const kind = this.player.heroKind;
    const power = this.player.magicPower || 0;
    let used = false;
    let fx = { kind, name: state.name, color: state.color };

    if (kind === 'vigil') {
      const healed = this.player.heal(4 + Math.floor(this.player.level / 4) + power);
      if (healed > 0) this.bus.emit('entity:healed', { entity: this.player, amount: healed, source: 'spell' });
      this.player.applyStatus({ id: 'def_buff', value: 2 + Math.floor(power / 4), duration: 3 });
      fx = { ...fx, center: { x: this.player.x, y: this.player.y }, radius: 1.4 };
      used = true;
    } else if (kind === 'hollow') {
      const target = state.target;
      if (!target) return;
      const dealt = this._dealSpellDamage(target, 5 + Math.floor(this.player.level / 3) + power, state.name);
      const healed = this.player.heal(Math.ceil(dealt * (0.45 + (this.player.spellLifesteal || 0))));
      if (healed > 0) this.bus.emit('entity:healed', { entity: this.player, amount: healed, source: 'spell' });
      fx = { ...fx, target: { x: target.x, y: target.y } };
      used = dealt > 0;
    } else if (kind === 'inquisitor') {
      const target = state.target;
      if (!target) return;
      used = this._damageEnemiesInRadius(
        target.x, target.y, state.radius,
        4 + Math.floor(this.player.level / 4) + power,
        state.name
      ) > 0;
      fx = { ...fx, center: { x: target.x, y: target.y }, radius: state.radius };
    } else if (kind === 'reaver') {
      used = this._damageEnemiesInRadius(
        this.player.x, this.player.y, state.radius,
        3 + Math.floor(this.player.totalAtk() / 2) + power,
        state.name
      ) > 0;
      if (used) this.player.applyStatus({ id: 'atk_buff', value: 1, duration: 2 });
      fx = { ...fx, center: { x: this.player.x, y: this.player.y }, radius: state.radius };
    } else if (kind === 'pilgrim') {
      const healed = this.player.heal(5 + Math.floor(this.player.level / 5) + power);
      if (healed > 0) this.bus.emit('entity:healed', { entity: this.player, amount: healed, source: 'spell' });
      this._revealAround(this.player.x, this.player.y, state.radius + Math.floor(power / 3));
      fx = { ...fx, center: { x: this.player.x, y: this.player.y }, radius: state.radius + Math.floor(power / 3) };
      used = true;
    }

    if (!used) return;
    const cd = Math.max(3, state.baseCooldown - (this.player.spellCooldownReduction || 0));
    this.player.spellCooldown = cd + 1;
    this.bus.emit('spell:cast', { entity: this.player, spell: state.name, fx });
    this._endPlayerTurn(true);
  }

  _nearestVisibleEnemy(range, requireLineOfSight = false) {
    let best = null;
    let bestDist = Infinity;
    for (const e of this.floor.enemies()) {
      if (e.isDead) continue;
      const t = this.floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      const dist = Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y);
      if (dist > range || dist >= bestDist) continue;
      if (requireLineOfSight && !hasLineOfSight(this.floor, this.player, e)) continue;
      best = e;
      bestDist = dist;
    }
    return best;
  }

  _damageEnemiesInRadius(cx, cy, radius, amount, spellName) {
    let total = 0;
    for (const e of [...this.floor.enemies()]) {
      if (e.isDead) continue;
      const dist = Math.abs(e.x - cx) + Math.abs(e.y - cy);
      if (dist > radius) continue;
      const dealt = this._dealSpellDamage(e, amount, spellName);
      total += dealt;
    }
    if (total > 0 && this.player.spellLifesteal > 0) {
      const healed = this.player.heal(Math.ceil(total * this.player.spellLifesteal));
      if (healed > 0) this.bus.emit('entity:healed', { entity: this.player, amount: healed, source: 'spell' });
    }
    return total;
  }

  _dealSpellDamage(target, amount, spellName) {
    const dealt = target.takeDamage(amount);
    this.bus.emit('entity:attacked', {
      attacker: this.player, target, damage: dealt,
      isCrit: false, isMiss: false, kind: 'magic'
    });
    this.bus.emit('entity:damaged', { entity: target, amount: dealt, source: spellName, isCrit: false });
    if (target.isDead) {
      this.combat._handleDeath(target, this.player, { floor: this.floor, floorIndex: this.dungeon.currentIndex });
    }
    return dealt;
  }

  _revealAround(cx, cy, radius) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (Math.abs(x - cx) + Math.abs(y - cy) > radius) continue;
        const tile = this.floor.tileAt(x, y);
        if (tile) tile.explored = true;
      }
    }
  }

  /** Generous tap hit on adjacent foe (sprite larger than one tile). */
  _tryTapAttackAdjacent(canvasX, canvasY) {
    const adj = this._adjacentEnemy();
    if (!adj || !this.renderer) return false;
    const cam = this.renderer.camera;
    const cx = (adj.renderX + 0.5) * TILE_SIZE + cam.x;
    const cy = (adj.renderY + 0.5) * TILE_SIZE + cam.y;
    if (Math.hypot(canvasX - cx, canvasY - cy) <= TILE_SIZE * 0.62) {
      this._attackEnemyAt(adj.x, adj.y);
      return true;
    }
    return false;
  }

  _playerPickup() {
    const stack = this.floor.itemsAt(this.player.x, this.player.y);
    if (stack.length === 0) return;
    const item = stack[stack.length - 1];
    const { added, overflow } = this.player.inventory.add(item);
    if (!added || overflow > 0) {
      if (!added) { this.bus.emit('inventory:full'); return; }
      item.count = overflow; // leave the rest on the ground
    } else {
      this.floor.takeItemAt(this.player.x, this.player.y);
    }
    this.bus.emit('item:pickedUp', { item, by: this.player });
    this._endPlayerTurn(true);
  }

  _playerDescend() {
    const t = this.floor.tileAt(this.player.x, this.player.y);
    if (!t || t.type !== TILE.STAIRS_DOWN) return;
    // Floor cleared bookkeeping.
    this.player.runStats.floorsCleared += 1;
    if (this.floor.clearedWithoutDamage) this.player.runStats.perfectFloors += 1;

    const next = this.dungeon.descend();
    if (!next) {
      this._endRun(true);
      return;
    }
    // Move the player to the new floor.
    this.floor.removeEntity(this.player);
    const { floor, spawns } = next;
    this.player.x = spawns.player.x; this.player.y = spawns.player.y;
    this.player.snapRender();
    floor.addEntity(this.player);
    this._spawnFloorEntities(floor, spawns);
    this.floor = floor;
    this.pathfinding.invalidate();
    this.lighting.compute(this.floor, this.player, this.player.torchRadius);
    this.state.patch('run.floorIndex', this.dungeon.currentIndex);
    this._emitFloorEntered(this.dungeon.currentIndex, floor);
    this._saveRun();
  }

  /** Use quick bar slot 0–2 (first consumables / throwables in bag order). */
  _playerQuickUse(quickIndex) {
    const slots = findQuickUseSlots(this.player.inventory);
    const invIdx = slots[quickIndex];
    if (invIdx === undefined) return;
    this._playerUseSlot(invIdx);
  }

  _playerUseSlot(index) {
    const item = this.player.inventory.getSlot(index);
    if (!item) return;
    // Equip is a free action.
    if (item.slot) {
      const result = Equipment.equipFromSlot(this.player, this.player.inventory, index);
      if (result.ok) this.bus.emit('player:equipped', { item: result.equipped });
      return;
    }
    // Throwables need a target — for v0.1, auto-target the nearest visible enemy in range.
    let throwTarget = null;
    if (item.target === 'tile') {
      throwTarget = this._autoTarget(item.range || 4);
      if (!throwTarget) {
        this.bus.emit('inventory:noTarget');
        return;
      }
    }
    const used = this.combat.useItemSlot({
      player: this.player, floor: this.floor,
      inventory: this.player.inventory, throwTarget
    }, index);
    if (used) this._endPlayerTurn(true);
  }

  _playerTapTile(tx, ty) {
    const dxRaw = tx - this.player.x;
    const dyRaw = ty - this.player.y;
    const targetEnemy = this.floor.entityAt(tx, ty);
    const distToTarget = Math.abs(dxRaw) + Math.abs(dyRaw);

    if (targetEnemy && targetEnemy.kind === 'enemy' && distToTarget === 1) {
      this._attackEnemyAt(tx, ty);
      return;
    }

    if (dxRaw === 0 && dyRaw === 0) {
      const adj = this._adjacentEnemy();
      if (adj) {
        this._attackEnemyAt(adj.x, adj.y);
        return;
      }
      const stack = this.floor.itemsAt(tx, ty);
      if (stack.length > 0) this._playerPickup();
      else this._endPlayerTurn(true);
      return;
    }

    if (targetEnemy && targetEnemy.kind === 'enemy') {
      const range = this.player.effectiveRange();
      if (range > 1 && distToTarget <= range &&
          hasLineOfSight(this.floor, this.player, targetEnemy)) {
        this.combat.execute(
          { type: 'ranged', target: { x: tx, y: ty } },
          this.player,
          { floor: this.floor, player: this.player }
        );
        this._endPlayerTurn(true);
        return;
      }
    }

    // Cardinal tap-to-walk (4-directional, dominant-axis step).
    let dx = 0, dy = 0;
    if (Math.abs(dxRaw) >= Math.abs(dyRaw)) dx = Math.sign(dxRaw);
    else dy = Math.sign(dyRaw);
    this._playerMove(dx, dy);
  }

  /** @returns {import('../entities/Enemy.js').Enemy|null} */
  _adjacentEnemy() {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const ent = this.floor.entityAt(this.player.x + dx, this.player.y + dy);
      if (ent && ent.kind === 'enemy' && !ent.isDead) return ent;
    }
    return null;
  }

  // --- turn management -----------------------------------------------
  _endPlayerTurn(actionTaken) {
    if (!actionTaken) return;
    if (this._processingTurn) return;
    this._processingTurn = true;
    try {
      this._resolvePlayerTurn();
    } catch (err) {
      console.error(LOG.CORE, 'turn resolution failed:', err);
    } finally {
      this._processingTurn = false;
    }
  }

  _resolvePlayerTurn() {
    this.player.runStats.turnsUsed += 1;
    // Passive skill tick (Second Wind regen, future passives).
    if (typeof this.player.passiveTurnTick === 'function') this.player.passiveTurnTick();
    this.combat.tickEntity(this.player);
    if (this.player.isDead) { this._endRun(false); return; }
    this._runEnemyTurns();
    // CRITICAL: enemy turns can kill the player. Without this check the
    // GameOver scene never triggered and the player was stuck on a dead
    // body that couldn't input. Bug from v0.2.0 first playtest.
    if (this.player.isDead) { this._endRun(false); return; }
    this.pathfinding.invalidate();
    this.lighting.compute(this.floor, this.player, this.player.torchRadius);
    this._refreshEnemyIntents();

    if (this.player.stats.hp < this.player.stats.hpMax) this.floor.clearedWithoutDamage = false;
    this._saveRun();
  }

  /** Show next-turn intent icons without re-running behavior AI (avoids Heavy counter drift). */
  _refreshEnemyIntents() {
    if (!this.floor || !this.player) return;
    for (const e of this.floor.enemies()) {
      if (e.isDead) continue;
      e.intent = this._peekEnemyIntent(e) || { type: 'wait' };
    }
  }

  _peekEnemyIntent(enemy) {
    const d = Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y);
    if (d === 1) return { type: 'attack', target: { x: this.player.x, y: this.player.y } };
    const beh = enemy.behavior;
    if (beh?.actEveryNTurns && typeof beh._counter === 'number') {
      const next = beh._counter + 1;
      if (next < beh.actEveryNTurns) {
        return { type: 'wait', meta: { winding: true } };
      }
    }
    if (beh?.range && d <= beh.range && d >= (beh.minDistance ?? 0)) {
      return { type: 'ranged', target: { x: this.player.x, y: this.player.y } };
    }
    if (d <= 8) return { type: 'move' };
    return { type: 'wait' };
  }

  _runEnemyTurns() {
    const enemies = this.floor.enemies()
      .map((e) => ({ e, d: Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) }))
      .sort((a, b) => a.d - b.d)
      .map((wrap) => wrap.e);

    const ctx = {
      floor: this.floor,
      player: this.player,
      rng: this.combat.rng,
      pathfinding: this.pathfinding,
      turn: this.player.runStats.turnsUsed
    };

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      try {
        const action = enemy.decide(ctx);
        this.combat.execute(action, enemy, ctx);
        this.combat.tickEntity(enemy);
      } catch (err) {
        console.error(LOG.CORE, `enemy turn failed (${enemy.defId}):`, err);
      }
      if (this.player.isDead) break;
    }
  }

  // --- spawning -------------------------------------------------------
  _spawnFloorEntities(floor, spawns) {
    // depthScale comes from the procedurally-built floor definition;
    // makes deeper floors actually threatening (HP & damage scale).
    const depthScale = floor.definition?.depthScale || 1;
    const diff = this._currentDifficulty();
    for (const s of spawns.enemies) {
      const def = this.content.enemies[s.defId];
      if (!def) { console.warn(LOG.ENTITY, `no enemy def "${s.defId}"`); continue; }
      const BehaviorCls = BEHAVIORS[def.behavior] || ChaseBehavior;
      const behavior = new BehaviorCls(def.behaviorParams);
      const enemy = new Enemy(def, behavior, { x: s.x, y: s.y }, depthScale, diff);
      enemy.snapRender();
      floor.addEntity(enemy);
    }
    for (const s of spawns.items) {
      const item = s.affixes
        ? this.itemFactory.createWithAffix(s.defId, s.affixes, 1)
        : this.itemFactory.create(s.defId, 1);
      if (item) floor.addItem(s.x, s.y, item);
    }
  }

  _createEnemy(defId, pos, floor) {
    const def = this.content.enemies[defId];
    if (!def) return null;
    const BehaviorCls = BEHAVIORS[def.behavior] || ChaseBehavior;
    const behavior = new BehaviorCls(def.behaviorParams);
    const enemy = new Enemy(def, behavior, pos,
      floor.definition?.depthScale || 1, this._currentDifficulty());
    enemy.snapRender();
    return enemy;
  }

  /**
   * Resolve current difficulty multipliers from meta.settings.difficulty.
   * Falls back to 'normal' when the setting is missing or unknown.
   */
  _currentDifficulty() {
    const settings = this.state?.state?.meta?.settings || {};
    const key = settings.difficulty || 'normal';
    const table = this.balance?.difficulty || {};
    const cfg = table[key] || table.normal || { enemyHp: 1, enemyAtk: 1 };
    return { hp: cfg.enemyHp || 1, atk: cfg.enemyAtk || 1, scoreMul: cfg.scoreMul || 1 };
  }

  /** Every run begins with a basic dagger — no cleaver/bow unless shop unlocks. */
  _applyStarterLoadout() {
    const dagger = this.itemFactory.create('worn_dagger', 1);
    if (dagger) this.player.equip(dagger);
  }

  _applyMetaUnlocks() {
    const meta = this.state.state.meta;
    if (!meta) return;

    // Score-threshold unlocks (legacy v0.1 system).
    for (const id of meta.unlocks || []) {
      if (id === 'worn_dagger') {
        if (this.player.weapon?.id === 'worn_dagger' && this.player.weapon.stats) {
          this.player.weapon.stats.atk = (this.player.weapon.stats.atk || 1) + 1;
        }
      } else if (id === 'veterans_vigor') {
        this.player.stats.hpMax += 10;
        this.player.stats.hp += 10;
      } else if (id === 'lucky_charm') {
        const charm = this.itemFactory.create('revive_charm', 1);
        if (charm) this.player.inventory.add(charm);
      } else if (id === 'map_sense') {
        if (this.dungeon.currentIndex === 0) this.floor?.revealAll();
      }
    }

    // Shop-purchased upgrades (coin economy).
    const ups = meta.shopUpgrades || {};
    if (ups.start_hp) {
      const bonus = ups.start_hp * 5;
      this.player.stats.hpMax += bonus;
      this.player.stats.hp += bonus;
    }
    if (ups.start_atk) this.player.stats.atk += ups.start_atk;
    if (ups.start_def) this.player.stats.def += ups.start_def;
    if (ups.start_dex) this.player.stats.dex += ups.start_dex;
    if (ups.extra_slot) {
      for (let i = 0; i < ups.extra_slot; i++) {
        this.player.inventory.size += 1;
        this.player.inventory.slots.push(null);
      }
    }
    if (ups.start_potion) {
      const potion = this.itemFactory.create('health_potion', 1);
      if (potion) this.player.inventory.add(potion);
    }
    if (ups.start_bow) {
      const bow = this.itemFactory.create('shortbow', 1);
      if (bow) {
        const swap = this.player.equip(bow);
        if (swap) this.player.inventory.add(swap);
      }
    }
    if (ups.start_revive) {
      this.player.reviveCharges += ups.start_revive;
    }
    if (ups.scholar_start) {
      // Grant just enough XP to hit level 2 immediately.
      const need = this.player.xpToNext();
      this.player.gainXP(need);
    }
  }

  // --- targeting helper ----------------------------------------------
  _autoTarget(range) {
    let best = null, bestDist = Infinity;
    for (const e of this.floor.enemies()) {
      const t = this.floor.tileAt(e.x, e.y);
      if (!t || !t.visible) continue;
      const d = Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y);
      if (d <= range && d < bestDist) { best = e; bestDist = d; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  // --- finalization --------------------------------------------------
  _endRun(victory) {
    this.save?.clearRun?.();
    const summary = {
      ...this.player.runStats,
      died: !victory,
      mode: this.mode,
      seed: this.seed
    };
    if (victory) this.bus.emit('run:victory', summary);
    else this.bus.emit('run:over', summary);
  }

  // --- commands from UI ----------------------------------------------
  _wireCommands() {
    this._listen('command:useSlot', ({ index }) => {
      this._playerUseSlot(index);
      this.inventoryUI.hide();
      this._saveRun();
    });
    this._listen('command:equipSlot', ({ index }) => {
      this._playerUseSlot(index);
      this.inventoryUI.hide();
      this._saveRun();
    });
    this._listen('command:dropSlot', ({ index }) => this._dropSlot(index));
    this._listen('command:unequip', ({ slot }) => this._unequipSlot(slot));
  }

  /**
   * Unequip a piece from the player and stash it back into the inventory.
   * Called from VigilScreen when user taps an UNEQUIP card button.
   */
  _unequipSlot(slot) {
    // Lazy import via dynamic — actually we already imported Equipment elsewhere.
    // Inline the logic to avoid circular import risk.
    const player = this.player;
    if (!player) return;
    const current = slot === 'weapon' ? player.weapon
                  : slot === 'armor'  ? player.armor
                  : slot === 'helm'   ? player.helm
                  : slot === 'legs'   ? player.legs
                  : slot === 'necklace' ? player.necklace
                  : slot === 'ring'   ? player.ring
                  : null;
    if (!current) return;
    if (player.inventory.isFull()) {
      this.bus.emit('inventory:full');
      return;
    }
    // Reverse stat side-effects.
    if (current.stats?.dex) player.stats.dex -= current.stats.dex;
    if (current.stats?.hpMaxBonus) {
      player.stats.hpMax = Math.max(1, player.stats.hpMax - current.stats.hpMaxBonus);
      player.stats.hp = Math.min(player.stats.hp, player.stats.hpMax);
    }
    if (slot === 'weapon') player.weapon = null;
    else if (slot === 'armor') player.armor = null;
    else if (slot === 'helm') player.helm = null;
    else if (slot === 'legs') player.legs = null;
    else if (slot === 'necklace') player.necklace = null;
    else if (slot === 'ring') player.ring = null;
    player.inventory.add(current);
    this.bus.emit('player:unequipped', { item: current, slot });
    this._saveRun();
  }

  _dropSlot(index) {
    const item = this.player.inventory.takeAll(index);
    if (!item) return;
    this.floor.addItem(this.player.x, this.player.y, item);
    this.bus.emit('item:dropped', { item });
    this._saveRun();
  }

  static _rarityColor(rarity) {
    switch (rarity) {
      case 'uncommon': return COLOR.itemUncommon;
      case 'rare': return COLOR.itemRare;
      case 'epic': return COLOR.itemEpic;
      default: return COLOR.goldDim;
    }
  }

  static _itemStatLine(item) {
    const parts = [];
    const s = item?.stats || {};
    if (s.atk) parts.push(`${s.atk > 0 ? '+' : ''}${s.atk} ATK`);
    if (s.def) parts.push(`${s.def > 0 ? '+' : ''}${s.def} DEF`);
    if (s.dex) parts.push(`${s.dex > 0 ? '+' : ''}${s.dex} DEX`);
    if (s.hpMaxBonus) parts.push(`+${s.hpMaxBonus} HP`);
    if (s.attackRange) parts.push(`RANGE ${s.attackRange}`);
    return parts.join('   ');
  }

  _saveRun() {
    if (!this.save || !this.player || !this.floor || this.player.isDead) return;
    const snapshot = {
      version: 1,
      savedAt: Date.now(),
      seed: this.seed,
      mode: this.mode,
      floorIndex: this.dungeon.currentIndex,
      player: this._playerSnapshot(),
      floor: this._floorSnapshot(this.floor)
    };
    this.save.saveRun(snapshot);
    this.state.setRun({
      seed: this.seed,
      mode: this.mode,
      floorIndex: this.dungeon.currentIndex,
      canContinue: true,
      level: this.player.level,
      hp: this.player.stats.hp,
      savedAt: snapshot.savedAt
    });
  }

  _playerSnapshot() {
    const itemSnap = (item) => {
      if (!item) return null;
      const s = { id: item.id, count: item.count || 1 };
      if (item.def?.affixes) s.affixes = item.def.affixes;
      return s;
    };
    return {
      pos: { x: this.player.x, y: this.player.y },
      stats: { ...this.player.stats },
      gold: this.player.gold,
      xp: this.player.xp,
      level: this.player.level,
      inventorySize: this.player.inventory.size,
      inventory: this.player.inventory.toSnapshot(),
      equipment: {
        weapon: itemSnap(this.player.weapon),
        armor: itemSnap(this.player.armor),
        helm: itemSnap(this.player.helm),
        legs: itemSnap(this.player.legs),
        necklace: itemSnap(this.player.necklace),
        ring: itemSnap(this.player.ring)
      },
      runStats: { ...this.player.runStats },
      reviveCharges: this.player.reviveCharges,
      skills: [...this.player.skills],
      xpMultiplier: this.player.xpMultiplier,
      skillLifesteal: this.player.skillLifesteal,
      damageReduction: this.player.damageReduction,
      skillRangeBonus: this.player.skillRangeBonus,
      regenEveryNTurns: this.player.regenEveryNTurns,
      regenAmount: this.player.regenAmount,
      turnsSinceRegen: this.player._turnsSinceRegen,
      magicPower: this.player.magicPower,
      spellCooldown: this.player.spellCooldown,
      spellCooldownReduction: this.player.spellCooldownReduction,
      spellLifesteal: this.player.spellLifesteal,
      critSkillBonus: this.player.critSkillBonus,
      statusEffects: this.player.statusEffects.map((e) => ({ ...e }))
    };
  }

  _floorSnapshot(floor) {
    const items = [];
    for (const [key, stack] of floor.items.entries()) {
      const [x, y] = key.split(',').map(Number);
      items.push({
        x, y,
        stack: stack.map((item) => {
          const snap = { id: item.id, count: item.count || 1 };
          if (item.def?.affixes) snap.affixes = item.def.affixes;
          return snap;
        })
      });
    }
    const enemies = floor.enemies().map((e) => ({
      defId: e.defId,
      x: e.x,
      y: e.y,
      stats: { ...e.stats },
      statusEffects: e.statusEffects.map((s) => ({ ...s })),
      rolledGold: e._rolledGold || 0,
      behaviorState: e.behavior?._counter !== undefined ? { counter: e.behavior._counter } : null
    }));
    const explored = [];
    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        if (floor.tiles[y][x].explored) explored.push([x, y]);
      }
    }
    return {
      index: floor.index,
      clearedWithoutDamage: floor.clearedWithoutDamage,
      items,
      enemies,
      explored
    };
  }

  _restorePlayerSnapshot(player, snap) {
    player.x = snap.pos?.x ?? player.x;
    player.y = snap.pos?.y ?? player.y;
    player.stats = { ...player.stats, ...(snap.stats || {}) };
    player.gold = snap.gold || 0;
    player.xp = snap.xp || 0;
    player.level = snap.level || 1;
    player.runStats = { ...player.runStats, ...(snap.runStats || {}) };
    player.reviveCharges = snap.reviveCharges || 0;
    player.skills = Array.isArray(snap.skills) ? [...snap.skills] : [];
    player.xpMultiplier = snap.xpMultiplier ?? 1;
    player.skillLifesteal = snap.skillLifesteal || 0;
    player.damageReduction = snap.damageReduction || 0;
    player.skillRangeBonus = snap.skillRangeBonus || 0;
    player.regenEveryNTurns = snap.regenEveryNTurns || 0;
    player.regenAmount = snap.regenAmount || 0;
    player._turnsSinceRegen = snap.turnsSinceRegen || 0;
    player.magicPower = snap.magicPower || 0;
    player.spellCooldown = snap.spellCooldown || 0;
    player.spellCooldownReduction = snap.spellCooldownReduction || 0;
    player.spellLifesteal = snap.spellLifesteal || 0;
    player.critSkillBonus = snap.critSkillBonus || 0;
    player.statusEffects = Array.isArray(snap.statusEffects) ? snap.statusEffects.map((e) => ({ ...e })) : [];
    const make = (s) => (s?.id ? this.itemFactory.fromSnapshot(s) : null);
    const eq = snap.equipment || {};
    player.weapon = make(eq.weapon);
    player.armor = make(eq.armor);
    player.helm = make(eq.helm);
    player.legs = make(eq.legs);
    player.necklace = make(eq.necklace);
    player.ring = make(eq.ring);
  }

  _restoreFloorSnapshot(floor, snap = {}) {
    floor.items = new Map();
    floor.clearedWithoutDamage = snap.clearedWithoutDamage !== false;
    floor.clearVisibility();
    for (const pair of snap.explored || []) {
      const [x, y] = pair;
      const t = floor.tileAt(x, y);
      if (t) t.explored = true;
    }
    for (const it of snap.items || []) {
      for (const itemSnap of it.stack || []) {
        const item = this.itemFactory.fromSnapshot(itemSnap);
        if (item) floor.addItem(it.x, it.y, item);
      }
    }
    for (const enemySnap of snap.enemies || []) {
      const enemy = this._createEnemy(enemySnap.defId, { x: enemySnap.x, y: enemySnap.y }, floor);
      if (!enemy) continue;
      enemy.stats = { ...enemy.stats, ...(enemySnap.stats || {}) };
      enemy.statusEffects = Array.isArray(enemySnap.statusEffects)
        ? enemySnap.statusEffects.map((e) => ({ ...e }))
        : [];
      enemy._rolledGold = enemySnap.rolledGold || 0;
      if (enemy.behavior && enemySnap.behaviorState?.counter !== undefined) {
        enemy.behavior._counter = enemySnap.behaviorState.counter;
      }
      enemy.isDead = enemy.stats.hp <= 0;
      if (!enemy.isDead) floor.addEntity(enemy);
    }
  }
}

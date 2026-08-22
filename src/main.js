/**
 * main.js — composition root. Constructs every subsystem exactly once,
 * wires dependencies, registers scene factories with Game, and boots.
 *
 * The order matters: things that emit events must exist before things that
 * subscribe to those events, but EventBus tolerates handlers being added at
 * any time — the only real constraint is that scene factories MUST be
 * registered before Game.boot() switches to the title scene.
 */
import { LOG, setPlayerUiScale } from './config/constants.js';
import { APP_VERSION } from './config/appInfo.js';
import { Capacitor } from '@capacitor/core';
import { setReduceMotion } from './config/layoutMetrics.js';
import { perfMeter } from './debug/PerfMeter.js';

// Native Play builds must never show the perf overlay (Capacitor hostname
// is localhost, which used to auto-enable it).
try {
  if (Capacitor.isNativePlatform()) perfMeter.setEnabled(false);
} catch { /* ignore */ }

// Boot splash: keep briefly so the reveal isn't jarring. Native builds use a
// shorter hold — mobile players should reach the title in ~2s, not 5+.
const _splashStart = (typeof performance !== 'undefined' ? performance.now() : Date.now());
const MIN_SPLASH_MS = (() => {
  try {
    return Capacitor.isNativePlatform() ? 1600 : 2200;
  } catch {
    return 2200;
  }
})();

function hideBootSplash({ immediate = false } = {}) {
  const splash = typeof document !== 'undefined' && document.getElementById('boot-splash');
  if (!splash) return;
  const remove = () => {
    splash.classList.add('boot-splash--hide');
    setTimeout(() => splash.remove(), 700);
  };
  if (immediate) return remove();
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - _splashStart;
  setTimeout(remove, Math.max(0, MIN_SPLASH_MS - elapsed));
}

import { EventBus } from './core/EventBus.js';
import { StateStore } from './core/StateStore.js';
import { SceneManager } from './core/SceneManager.js';
import { GameLoop } from './core/GameLoop.js';
import { Game } from './core/Game.js';
import { GameScene } from './core/GameScene.js';

import { SaveManager } from './persistence/SaveManager.js';
import { MetaProgress } from './persistence/MetaProgress.js';

import { SpriteRegistry } from './rendering/SpriteRegistry.js';
import { CameraShake } from './rendering/CameraShake.js';
import { ParticleSystem } from './rendering/ParticleSystem.js';
import { LightingSystem } from './rendering/LightingSystem.js';
import { Renderer } from './rendering/Renderer.js';

import { AudioManager } from './audio/AudioManager.js';

import { MessageLog } from './ui/MessageLog.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { SkillPickerUI } from './ui/SkillPickerUI.js';
import { SkillsModal } from './ui/SkillsModal.js';
import { VigilScreen } from './ui/VigilScreen.js';
import { TitleScreen } from './ui/TitleScreen.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
import { OpeningCinematic } from './ui/OpeningCinematic.js';
import { GameOverScreen } from './ui/GameOverScreen.js';
import { VictoryScreen } from './ui/VictoryScreen.js';
import { MobileControls } from './ui/MobileControls.js';
import { QuickUseBar } from './ui/QuickUseBar.js';
import { PauseOverlay } from './ui/PauseOverlay.js';
import { CraftingPanel } from './ui/CraftingPanel.js';
import { FloorEventPanel } from './ui/FloorEventPanel.js';
import { TutorialOverlay } from './ui/TutorialOverlay.js';

import { InputManager } from './input/InputManager.js';

import { LoreDatabase } from './narrative/LoreDatabase.js';
import { DialogueSystem } from './narrative/DialogueSystem.js';

import { DEFAULT_BALANCE, mergeBalance } from './config/balance.js';
import { BillingService } from './monetization/BillingService.js';
import { AdService } from './monetization/AdService.js';
import { FALLBACK_PRICE_LABEL } from './monetization/products.js';
import { PaywallOverlay } from './ui/PaywallOverlay.js';

// Content imports are STATIC so Vite bundles them at build time. This means:
//   - Production builds (Vercel, Capacitor APK) work without runtime fetch.
//   - Dev still gets HMR — edit a JSON file and the page reloads.
//   - One source of truth: data/*.json. No copy to public/ needed.
import itemsData   from '../data/items.json';
import enemiesData from '../data/enemies.json';
import floorsData  from '../data/floors.json';
import loreData    from '../data/lore.json';
import balanceData from '../data/balance.json';
import biomesData  from '../data/biomes.json';
import skillsData  from '../data/skills.json';
import shopData    from '../data/shop.json';
import setsData         from '../data/sets.json';
import materialsData    from '../data/materials.json';
import recipesData      from '../data/recipes.json';
import achievementsData from '../data/achievements.json';
import { HERO_SPELLS } from './config/heroSpells.js';
import { validateContent, logValidationReport } from './content/validators.js';
import { loadSetDefs } from './items/Sets.js';
import { loadRecipes } from './items/Crafting.js';
import { setLocale } from './content/i18n.js';
import { Analytics } from './persistence/Analytics.js';
import { AchievementEngine, loadAchievementDefs } from './persistence/Achievements.js';
import { AchievementToast } from './ui/AchievementToast.js';
import { repairItemDefStats } from './items/canonicalStats.js';

async function bootstrap() {
  console.log(LOG.CORE, `Shadow Depths v${APP_VERSION} — bootstrap`);

  // --- core plumbing -------------------------------------------------
  const bus = new EventBus();
  const state = new StateStore(bus);
  const sceneManager = new SceneManager(bus);

  // --- persistence ---------------------------------------------------
  const saveManager = new SaveManager();

  // --- content (bundled at build time) + balance merge ---------------
  const content = {
    items: itemsData,
    enemies: enemiesData,
    floors: floorsData,
    lore: loreData,
    balance: balanceData,
    biomes: biomesData,
    skills: skillsData,
    shop: shopData,
    achievements: achievementsData
  };
  const balance = mergeBalance(content.balance) || DEFAULT_BALANCE;
  loadSetDefs(setsData);
  loadRecipes(recipesData);
  loadAchievementDefs(achievementsData);
  // Merge material defs into the main item registry so they share the same
  // factory + inventory + sprite pipeline.
  Object.assign(content.items, materialsData.materials || {});
  repairItemDefStats(content.items);

  // Content validation runs once at boot. Failures are warnings, not
  // fatal, so the game still loads even when a single entry is malformed.
  logValidationReport(validateContent({
    items: content.items,
    enemies: content.enemies,
    skills: content.skills,
    biomes: content.biomes,
    heroSpells: HERO_SPELLS,
    achievements: achievementsData,
    sets: setsData,
    recipes: recipesData
  }));

  // --- meta progress -------------------------------------------------
  const metaProgress = new MetaProgress({ saveManager, balance, eventBus: bus });
  metaProgress.load();
  Object.assign(state.state.meta, metaProgress.state);
  // Expose meta to UI modules that need read-only access without coupling
  // (e.g. InventoryUI tooltip checking identification state).
  globalThis.__shadowDepthsMeta = state.state.meta;

  // --- monetization (Play one-time unlock) ---------------------------
  const billingService = new BillingService({ metaProgress, eventBus: bus, balance });
  if (balance.monetization?.fallbackPriceLabel) {
    billingService._priceLabel = balance.monetization.fallbackPriceLabel;
  } else {
    billingService._priceLabel = FALLBACK_PRICE_LABEL;
  }
  const paywallOverlay = new PaywallOverlay({ bus, billing: billingService });
  bus.on('billing:unlocked', () => {
    Object.assign(state.state.meta, metaProgress.state);
  });
  // Fire-and-forget store init (restore + price fetch on native). This also
  // restores a prior purchase, so it must settle before ads start: an owner
  // reinstalling should never see a banner flash before the entitlement lands.
  const adService = new AdService({ billing: billingService, eventBus: bus, balance });
  bus.on('scene:switched', ({ to }) => {
    void adService.onSceneChanged(to).catch((err) => {
      console.warn(LOG.CORE, 'ads scene placement:', err);
    });
  });
  billingService.init()
    .catch((err) => console.warn(LOG.CORE, 'billing init:', err))
    .finally(() => {
      adService.init()
        .then(() => adService.onSceneChanged(sceneManager.currentName || 'title'))
        .catch((err) => console.warn(LOG.CORE, 'ads init:', err));
    });

  // Locale from saved meta (default 'en' if absent / unsupported).
  setLocale(state.state.meta.settings?.locale || 'en');
  // Accessibility prefs from meta (affect layout FX + UI scale immediately).
  setPlayerUiScale(state.state.meta.settings?.textScale || 1);
  setReduceMotion(!!state.state.meta.settings?.reduceMotion);

  // Analytics — passive event capture, persisted via saveMeta.
  // Hold a reference so it isn't garbage collected.
  // eslint-disable-next-line no-unused-vars
  const analytics = new Analytics({ bus, state });
  // eslint-disable-next-line no-unused-vars
  const achievements = new AchievementEngine({ bus, state });
  const achievementToast = new AchievementToast({ bus });
  // NOTE: renderer.overlayRender is assigned AFTER renderer is constructed
  // (further down). Touching it here triggers TDZ on `const renderer`.

  // --- rendering pipeline --------------------------------------------
  const canvas = document.getElementById('game-canvas');
  if (!canvas) throw new Error('#game-canvas not found in DOM');
  const sprites = new SpriteRegistry();
  const cameraShake = new CameraShake();
  const particles = new ParticleSystem({ bus });
  const lighting = new LightingSystem(balance);
  const renderer = new Renderer({
    canvas, sprites, cameraShake, lighting, particles, eventBus: bus
  });
  // Top-most achievement toast overlay — wired now that renderer exists.
  renderer.overlayRender = (r) => achievementToast.render(r);

  // --- audio ---------------------------------------------------------
  const audio = new AudioManager({ bus, metaProgress });
  // First user gesture resumes the audio context — Web Audio policy.
  const resumeAudioOnce = () => {
    audio.play('footstep'); // harmless ping to bootstrap the ctx
    audio.setVolume(metaProgress.state.settings.volume);
    window.removeEventListener('keydown', resumeAudioOnce);
    window.removeEventListener('pointerdown', resumeAudioOnce);
    window.removeEventListener('touchstart', resumeAudioOnce);
  };
  window.addEventListener('keydown', resumeAudioOnce, { once: true });
  window.addEventListener('pointerdown', resumeAudioOnce, { once: true });
  window.addEventListener('touchstart', resumeAudioOnce, { once: true });

  // --- UI components -------------------------------------------------
  const messageLog = new MessageLog({ bus, enemyDefs: content.enemies });
  const hud = new HUD({ messageLog });
  const minimap = new Minimap();
  const inventoryUI = new InventoryUI({ bus, materialDefs: materialsData.materials || {} });
  const skillPicker = new SkillPickerUI({ bus, content, metaProgress, adService });
  const skillsModal = new SkillsModal({ content });
  const vigilScreen = new VigilScreen({ bus });
  const characterSelect = new CharacterSelect({ bus, metaProgress });
  const mobileControls = new MobileControls({ bus });
  const quickUseBar = new QuickUseBar({ bus });
  const pauseOverlay = new PauseOverlay({ bus });
  const craftingPanel = new CraftingPanel({
    bus, player: null, materialDefs: materialsData.materials || {}
  });
  const floorEventPanel = new FloorEventPanel({ bus });
  const tutorial = new TutorialOverlay({ metaProgress, bus });

  const resetRunModals = () => {
    skillPicker.hide();
    skillsModal.hide();
    pauseOverlay.hide();
    inventoryUI.hide();
    vigilScreen.hide();
    floorEventPanel.hide();
  };
  bus.on('request:newRun', resetRunModals);
  bus.on('scene:switched', ({ to }) => {
    if (to === 'title' || to === 'gameover' || to === 'victory') resetRunModals();
  });

  // --- narrative -----------------------------------------------------
  const lore = new LoreDatabase(content.lore);
  const dialogue = new DialogueSystem({ bus });
  // Stash for future tooltip lookup.
  window.__shadowdepths = { lore, dialogue, state, bus };

  // --- scene factories ----------------------------------------------
  const sceneFactories = {
    title: (deps) => new TitleScreen({
      ...deps, metaProgress, characterSelect, billingService, paywallOverlay, lore
    }),
    opening: (deps) => new OpeningCinematic(deps),
    game: (deps) => new GameScene({
      ...deps, hud, minimap, inventoryUI, skillPicker, skillsModal, vigilScreen,
      lighting, renderer, mobileControls, quickUseBar, pauseOverlay,
      craftingPanel, floorEventPanel, tutorial,
      metaProgress, billingService, paywallOverlay, adService
    }),
    gameover: (deps) => new GameOverScreen({ ...deps, adService }),
    victory: (deps) => new VictoryScreen(deps)
  };

  // --- game loop -----------------------------------------------------
  const gameLoop = new GameLoop({
    eventBus: bus, sceneManager, renderer, stateStore: state
  });

  // --- top-level orchestrator ---------------------------------------
  const game = new Game({
    eventBus: bus,
    stateStore: state,
    sceneManager,
    gameLoop,
    saveManager,
    metaProgress,
    billingService,
    paywallOverlay,
    sceneFactories,
    content,
    balance
  });

  // --- input — needs sceneManager so it can route into the active scene
  const _input = new InputManager({ bus, sceneManager, canvas });

  // Mark unused locals as intentionally retained (suppress lint noise).
  void _input; void mobileControls; void particles; void cameraShake;

  if (Capacitor.isNativePlatform()) {
    document.documentElement.classList.add('capacitor-native');
  }

  // Android hardware back + background pause (Play Store hygiene).
  await wireNativeLifecycle({ bus, gameLoop, sceneManager, audio, paywallOverlay });

  await game.boot();
  console.log(LOG.CORE, 'Shadow Depths bootstrap complete');

  // Title scene is live behind the splash — fade the boot splash away
  // (kept up at least MIN_SPLASH_MS so the reveal animation finishes).
  hideBootSplash();
}

/**
 * Capacitor App plugin: pause rAF when backgrounded; route hardware back
 * through open modals → pause → title → (minimize left to OS).
 */
async function wireNativeLifecycle({ bus, gameLoop, sceneManager, audio, paywallOverlay }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        gameLoop.resumeRendering?.();
        try { audio?.resume?.(); } catch { /* optional */ }
        bus.emit('app:foreground', {});
      } else {
        gameLoop.pauseRendering?.();
        try { audio?.suspend?.(); } catch { /* optional */ }
        // Flush in-progress run immediately — debounced save can lose Continue
        // if the OS kills the WebView before idle callback fires.
        try {
          const scene = sceneManager.current;
          if (scene && typeof scene.flushRunSave === 'function') {
            scene.flushRunSave();
          } else if (typeof scene?._flushRunSave === 'function') {
            scene._flushRunSave();
          }
        } catch { /* ignore save errors on background */ }
        bus.emit('app:background', {});
      }
    });
    App.addListener('backButton', async ({ canGoBack }) => {
      void canGoBack;
      const scene = sceneManager.current;
      if (paywallOverlay?.open) {
        paywallOverlay.hide();
        return;
      }
      // Close in-scene overlays first (pause / inventory / settings).
      if (scene?.pause?.open || scene?.inventoryUI?.open || scene?.settingsOpen
          || scene?.modal || scene?.skillPicker?.open || scene?.craftUI?.open) {
        scene.handleInput?.({ type: 'escape' });
        return;
      }
      const name = sceneManager.currentName;
      if (name === 'game' || name === 'opening' || scene?.player) {
        bus.emit('request:quitToTitle', {});
        return;
      }
      if (name === 'gameover' || name === 'victory') {
        bus.emit('request:quitToTitle', {});
        return;
      }
      // Title: minimize instead of exiting abruptly.
      try { await App.minimizeApp(); } catch { /* web / unsupported */ }
    });
  } catch (err) {
    console.warn(LOG.CORE, 'native lifecycle wire failed:', err);
  }
}

// Catch unhandled errors AFTER boot too — without this, a black-screen
// freeze gives the player no signal. Renders a translucent overlay
// instead of nuking the canvas so they can still see what was there.
if (typeof window !== 'undefined') {
  let _shown = false;
  const showRuntimeError = (msg) => {
    if (_shown) return;
    _shown = true;
    hideBootSplash({ immediate: true });
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#1a0810;color:#ffd0d0;font:11px monospace;padding:8px 10px;border:1px solid #ff6060;border-radius:6px;max-height:40vh;overflow:auto;white-space:pre-wrap;line-height:1.4';
    div.textContent = String(msg);
    document.body.appendChild(div);
  };
  window.addEventListener('error', (e) => {
    showRuntimeError((e.error && e.error.stack) || e.message || 'unknown error');
  });
  window.addEventListener('unhandledrejection', (e) => {
    showRuntimeError((e.reason && e.reason.stack) || e.reason || 'unhandled rejection');
  });
}

bootstrap().catch((err) => {
  console.error('[Bootstrap]', err);
  // Boot failed — drop the splash immediately so the error is visible.
  hideBootSplash({ immediate: true });
  const root = document.getElementById('game-root');
  if (root) {
    root.innerHTML = `
      <div style="color:#d6d6da;font-family:monospace;padding:24px;line-height:1.6">
        <h2 style="color:#ff6060">Shadow Depths failed to boot</h2>
        <pre style="white-space:pre-wrap;background:#1a1820;padding:12px;border-radius:6px">${String(err && err.stack || err)}</pre>
        <p>Check the console for details. If this persists, run <code>npm install</code> again and reload.</p>
      </div>
    `;
  }
});

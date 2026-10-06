import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../src/core/GameLoop.js';
import { GameScene } from '../src/core/GameScene.js';
import { Renderer } from '../src/rendering/Renderer.js';
import { CameraShake } from '../src/rendering/CameraShake.js';
import { ParticleSystem } from '../src/rendering/ParticleSystem.js';
import { Layout, setReduceMotion } from '../src/config/layoutMetrics.js';
import { perfMeter } from '../src/debug/PerfMeter.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setReduceMotion(false);
  perfMeter.setEnabled(false);
  perfMeter.frame = null;
});

function context() {
  return new Proxy({}, {
    get: (_target, key) => key === 'createRadialGradient' || key === 'createLinearGradient'
      ? () => ({ addColorStop() {} }) : () => {},
    set: () => true
  });
}

describe('Android audit: rendering', () => {
  it.each([30, 60].flatMap(target => [60, 90, 120, 144, 240].map(refresh => [target, refresh])))
  ('maintains a %i FPS target at %i Hz instead of discarding residual time', (target, refresh) => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    let frames = 0;
    const loop = new GameLoop({
      eventBus: { emit() {} }, sceneManager: { update() {} },
      renderer: { render() { frames++; } }, stateStore: { state: { time: 0 } }
    });
    loop._running = true;
    for (let n = 0; n <= refresh * 5; n++) {
      loop._targetMs = 1000 / target;
      loop._frameEma = 1;
      loop._loop(1000 + n * 1000 / refresh);
    }
    expect(frames).toBeGreaterThanOrEqual(target * 5);
    expect(frames).toBeLessThanOrEqual(target * 5 + 2);
  });

  it('clamps long gaps and excludes background time from resumed simulation', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(performance, 'now').mockReturnValue(60_000);
    const ticks = [];
    const state = { state: { time: 0 } };
    const loop = new GameLoop({
      eventBus: { emit(event, payload) { if (event === 'tick') ticks.push(payload.dt); } },
      sceneManager: { update() {} }, renderer: { render() {} }, stateStore: state
    });
    loop._running = true;
    loop._loop(1000);
    loop.pauseRendering();
    loop.resumeRendering();
    loop._loop(60_017);
    expect(ticks.at(-1)).toBeLessThanOrEqual(1 / 30);
    expect(state.state.time).toBeLessThan(0.1);
    loop._loop(66_017);
    expect(ticks.at(-1)).toBeCloseTo(1 / 15, 8);
  });

  it('computes the camera from the same interpolated position used to draw the player', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const player = { x: 11, y: 10, renderX: 10, renderY: 10 };
    const floor = { entities: new Map([['player', player]]) };
    let cameraX;
    const renderer = {
      ctx: context(), _camera: {},
      setCameraFor(x) { cameraX = x; }, drawFloor() {}, drawGroundItems() {}, drawTelegraphs() {},
      updateEntityPositions(activeFloor, dt) {
        Renderer.prototype.updateEntityPositions?.call(this, activeFloor, dt);
      },
      _sortedEntities: () => [], _drawAttackFlashes() {},
      drawEntities: Renderer.prototype.drawEntities
    };
    GameScene.prototype.renderWorld.call({
      floor, player, state: { state: {} }, _lastRenderTime: 1000 - 1000 / 60
    }, renderer);
    expect(player.renderX).toBeGreaterThan(10);
    expect(cameraX).toBeCloseTo(player.renderX, 8);
  });

  it('reuses both floor cache canvases while vision changes', () => {
    let allocated = 0;
    const ctx = context();
    vi.stubGlobal('OffscreenCanvas', class {
      constructor(width, height) { this.width = width; this.height = height; allocated++; }
      getContext() { return ctx; }
    });
    const renderer = {
      ctx, _camera: { x: 0, y: Layout.hud }, _leanCombatFx: true,
      _drawCachedViewportBackdrop() {}, _drawTorchGlowLive() {}, _paintTileBase() {},
      _drawCachedTileBase: Renderer.prototype._drawCachedTileBase,
      _paintFloorWorldLayer(paintCtx, floor, _player, x0, y0, x1, y1) {
        this._drawCachedTileBase(paintCtx, floor, x0, y0, x1, y1);
      }
    };
    const floor = { width: 40, height: 28, seed: 42, index: 0, visibilityRevision: 0, definition: {} };
    for (let n = 0; n < 12; n++) {
      floor.visibilityRevision++;
      Renderer.prototype.drawFloor.call(renderer, floor, null);
    }
    expect(allocated).toBe(2);
  });

  it('turning Reduce Motion on immediately suppresses an existing camera shake', () => {
    setReduceMotion(false);
    const shake = new CameraShake();
    shake.trigger(8, 1000);
    setReduceMotion(true);
    expect(shake.offset()).toEqual({ x: 0, y: 0 });
    shake.trigger(8, 1000);
    expect(shake.offset()).toEqual({ x: 0, y: 0 });
  });

  it('updates the particle budget on the next frame when Reduce Motion changes', () => {
    setReduceMotion(false);
    const particles = new ParticleSystem({ bus: { on() {} } });
    setReduceMotion(true);
    particles.update(0);
    expect(particles._maxParticles).toBe(48);
  });

  it('records enemy-turn work that happens between rendering frames', () => {
    vi.stubGlobal('localStorage', { setItem() {} });
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(112);
    perfMeter.ema = {};
    perfMeter.max = {};
    perfMeter.setEnabled(true);
    perfMeter.measure('enemyTurn', () => 7);
    expect(perfMeter.ema.enemyTurn).toBe(12);
    expect(perfMeter.max.enemyTurn).toBe(12);
  });
});

# Shadow Depths

A turn-based roguelike dark fantasy for mobile (primary) and web (development / secondary).
Built on a vanilla ES6 + Vite stack so it can be wrapped with Capacitor for the Play Store
later without architectural rewrites.

> **Status:** v0.1.0 foundation build — **complete and playable**.
> **Target:** Mobile / Google Play Store via Capacitor wrap (v0.2).
> See [docs/RUNBOOK.md](docs/RUNBOOK.md) for first-run, mobile testing, and Play Store steps.

---

## Vision

Shadow Depths is built around three gameplay pillars. Every feature in the codebase must
serve at least one of them; if it serves none, it's decorative and gets cut.

1. **Decision Density** — every turn is a meaningful choice, never an auto-attack.
2. **Build Expressiveness** — items interact; two players build differently from the same drops.
3. **Failure as Fuel** — permadeath that feels deserved, with a 1-tap restart.

Inspirations: Pixel Dungeon (systems depth), Hoplite (decision clarity), Cogmind (tactical
richness), Slay the Spire (run pacing). Hades-style narrative lands in v0.5.

## Quick Start

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # → dist/
npm run preview  # serve dist/ on LAN for mobile playtest
npm run lint
```

Open the dev URL on a phone over LAN to test touch controls. The viewport meta tag and
touch handlers are wired up from day one.

## Architecture (Why the folders look like this)

```
src/
  config/      structural constants (TILE_SIZE, palette, keybinds) + balance defaults
  core/        Game orchestrator, EventBus, StateStore, GameLoop, SceneManager, RNG
  world/       Dungeon, BSP generator, Floor, Tile, A* pathfinding         (Part 2)
  entities/    Entity, Player, Enemy + composable AI behaviors             (Part 2)
  items/       Item, ItemFactory, Inventory, Equipment                     (Part 3)
  combat/      CombatSystem, StatusEffects                                  (Part 3)
  rendering/   Renderer, SpriteRegistry, ParticleSystem, lighting, shake   (Part 4)
  audio/       AudioManager + Web Audio synth SFX                          (Part 4)
  ui/          HUD, InventoryUI, MessageLog, Minimap, screens, mobile pad  (Part 5)
  input/       InputManager, KeyboardHandler, TouchHandler                 (Part 5)
  persistence/ SaveManager (versioned schema + migrations), MetaProgress   (Part 3)
  narrative/   LoreDatabase, DialogueSystem stub (active in v0.5)          (Part 5)
data/          items.json, enemies.json, floors.json, lore.json, balance.json
```

**Key principles:**

- **Data-driven content.** Items and enemies live in `data/*.json`. Adding a new sword in
  v0.2 will be a JSON edit, not a code change.
- **Event bus decoupling.** `entity:damaged` is emitted once; HUD, audio, camera shake,
  and (later) achievements all subscribe independently.
- **Behavior composition for AI.** Each enemy AI is a small class in
  `src/entities/behaviors/`. The JSON references it by name. New enemy = new file, no
  inheritance hell.
- **Versioned saves.** `SaveManager` writes a schema version and runs migrations on load
  so save data survives every future release.
- **Sprite abstraction.** All draw calls go through `SpriteRegistry.draw(key, ctx, x, y)`.
  v0.1 generates procedural rectangles; v0.3 swaps in a spritesheet behind the same API.
- **Seeded RNG.** Every subsystem (dungeon gen, combat, loot) forks its own RNG instance
  from the run seed. Render jitter never desyncs gameplay rolls.

## Tech Choices

| Layer | Choice | Why |
| --- | --- | --- |
| Build | Vite | Fast HMR, zero-config ES modules, easy Capacitor wrap later |
| Render | Canvas 2D | Procedural now, sprite-ready via the abstraction layer |
| State | Custom event bus + store | Decoupled, additive, testable; no framework lock-in |
| Save | localStorage + versioned schema | Works offline, survives schema changes |
| Audio | Web Audio synth | Zero asset weight in MVP; file slots ready for v0.3 |
| RNG | mulberry32 (seeded) | Reproducible runs for debugging and v0.4 daily seeds |
| Distribution | Web → Capacitor → APK | Vanilla web stack reused, no engine lock-in |

## Build State

v0.1.0 — **all 6 parts shipped**. The game is end-to-end playable on desktop and mobile browsers.

| Part | Scope | Status |
| --- | --- | --- |
| 1 | Project skeleton + `config/` + `core/` + `data/` | ✅ |
| 2 | `world/` (BSP gen, A\*) + `entities/` (5 enemy AI) | ✅ |
| 3 | `items/` (inventory) + `combat/` + `persistence/` (versioned save + meta) | ✅ |
| 4 | `rendering/` (sprite/shake/particles/lighting) + `audio/` (9 synth SFX) | ✅ |
| 5 | `ui/` (HUD/inventory/screens/mobile pad) + `input/` + `narrative/` + `main.js` | ✅ |
| 6 | `CHANGELOG.md`, [docs/RUNBOOK.md](docs/RUNBOOK.md), README polish | ✅ |

**Content delivered:**

- 3 dungeon floors (The Forgotten Crypts → Halls of Echoes → The Bone Garden)
- 5 enemy types with distinct AI (Chase / Ranged-LOS / Erratic / Heavy / Phase)
- **48 items** (expanded from brief's 15 on request; all data-driven, zero code change to add more)
- 3 status effects (poison stackable, atk_buff, def_buff) — registry ready for v0.4 (Burn/Freeze/Bleed)
- 9 procedural SFX, fog of war + torch radius, camera shake, floating damage numbers
- Mobile-first: auto-detected DOM D-pad + action buttons, 48dp targets, canvas-tap inventory

## Assumptions made while scaffolding

These were calls made without confirmation; flag any you want changed:

1. **Render target = 960×672** (40×28 tiles × 24px). The canvas scales to viewport via CSS;
   intrinsic resolution stays fixed so sprite swap in v0.3 doesn't have to re-derive a grid.
2. **Default font = monospace** in the page shell so any HTML fallback (error overlay,
   accessibility text) matches the in-canvas pixel-y aesthetic.
3. **`balance.json` is preferred over `balance.js`** at runtime. The JS file is the safety
   net and the canonical default. If JSON is broken, the engine still boots.
4. **One `EventBus` instance for the whole app.** No namespacing yet. If we hit cross-talk
   in v0.4 we'll introduce scoped buses; premature now.
5. **`StateStore.patch()` mutates in place** (not a Redux-style new object). Solo dev,
   single-player game — the cost of forced immutability isn't worth the safety it would buy.

## Roadmap

| Version | Focus | ETA |
| --- | --- | --- |
| v0.1 | Foundation: arch, core loop, 3 floors, 5 enemies, 15 items | Now |
| v0.2 | Capacitor wrap, Android internal track | Month 1 |
| v0.3 | Sprite assets, audio pass, 5 floors | Month 2–3 |
| v0.4 | Status effects expansion, 5 bosses, daily seed | Month 3–4 |
| v0.5 | Narrative pass: NPCs, dialogue, lore items, 10 floors | Month 4–6 |
| v0.6 | Achievements, online leaderboard (Firebase), cloud save | Month 6–7 |
| v0.7 | Class system, prestige | Month 7–9 |
| v0.8 | Polish, soft launch | Month 9–10 |
| v1.0 | Play Store launch + day-1 patch | Month 11–12 |

## License

Proprietary — all rights reserved by Fajar until further notice.

---

*Build slow. Build right. Iterate forever.*

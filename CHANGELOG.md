# Changelog

All notable changes to Shadow Depths will be recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [Semantic Versioning](https://semver.org/).

---

## [0.2.7] — 2026-08-11 — Performance & Polish

### Fixed

- **Lag:** the in-game UI layer was re-rendered from scratch every frame
  (`_uiCacheKey()` was never wired in). It is now composited once per turn
  into a cached offscreen layer and blitted 1:1 on unchanged frames.
- **Death/Victory screens:** narrative footer lines (tips, teaser, build
  summary) no longer truncate mid-sentence — text word-wraps to 2–3 lines
  and the panel height adapts to its content. Epitaph wraps too.
- **Settings:** CLOSE button no longer overlaps the HIGH-CONTRAST row
  (relative-vs-absolute Y bug); fixed hint/label overlap; added a compact
  two-column landscape layout.

### Changed

- **English-only build.** Removed the Indonesian locale and the LANGUAGE
  toggle from Settings; legacy `locale: 'id'` saves fall back to English.

---

## [0.1.0] — 2026-05-24 — Foundation

First playable foundation. Game runs end-to-end on desktop and mobile browsers.
No assets yet (everything procedural); ready for Capacitor wrap in v0.2.

### Added

**Core architecture**
- ES6 module project on Vite. `npm run dev` boots in <1 s.
- Event bus + state store + scene manager + rAF game loop, fully decoupled.
- Seeded RNG (mulberry32) with per-subsystem forks so render jitter never desyncs gameplay.
- Versioned save schema (`SAVE_SCHEMA_VERSION = 1`) with migration pipeline scaffolded.

**Gameplay (turn-based)**
- BSP dungeon generator (3 floors: The Forgotten Crypts → Halls of Echoes → The Bone Garden).
- A\* pathfinding with per-turn cache + binary-heap open set.
- 5 distinct enemy AI: Chase, Ranged (with Bresenham LOS + kiting), Erratic, Heavy (acts every N turns), Phase (wall-clip).
- Damage formula per spec: `max(1, ATK − DEF ± 1)` with crit chance `0.05 + DEX × 0.01 + weapon bonus`.
- Enemy intent telegraph: `!` attack, `➜` ranged, `·` move, `⌛` winding (Heavy), `…` wait.
- Status effects (poison stackable, atk_buff, def_buff) with registry ready for v0.4 expansion (Burn/Freeze/Bleed).
- Revive Charm logic in CombatSystem (auto-revive once, restore 50% maxHP).

**Content (48 items, expanded beyond brief's 15)**
- 12 weapons (incl. Mythril Blade, Vampiric Dagger, Heartseeker Rapier, Obsidian Shard with DEX trade-off).
- 7 armor pieces (incl. Plated Mail with DEX penalty, Wraithcloak with DEX bonus).
- 4 healing potions (incl. Blood Cordial — heal + atk_buff combo).
- 3 max-HP crystals (Sliver of the Heart, Ironheart Shard, Heart Crystal).
- 3 XP items (Crumpled Page, Tome of Wisdom, Ancient Codex).
- 6 buff consumables (incl. Long Vigil Tea — dual atk+def buff, Phantom Vial — 15-turn sustain).
- 7 throwables (poison vials, plague flask, caltrop pouch, concussive bomb, fire bomb, voidshard, pyre capsule).
- 3 scrolls (Mapping, Foresight, Recall).
- 3 passives (Revive Charm, Bone Talisman, Twin Charm — 2 revive charges via dual `autoReviveOnce` effects).

**Rendering & game feel**
- Sprite registry: procedural draws today, swap to `drawImage` in v0.3 with zero call-site change.
- Camera shake (additive impulses, proportional to damage; longer on crit/bomb).
- Particle system: sparks (gravity-affected) + floating damage/heal/XP text.
- Lighting: Bresenham-cast torch radius (5 default, 4 on floor 3); explored-but-unseen tiles drawn dim + 55% black wash.
- Movement tween 80 ms per tile (renderX/Y lerp toward grid pos).

**Audio**
- 9 procedural SFX (footstep, attack, hit, crit, pickup, level-up arpeggio, death sweep, floor entry chord, drink glissando).
- Web Audio context lazy-resumed on first user gesture (mobile policy compliance).

**UI**
- Title screen (animated atmosphere particles + 3 buttons + controls modal).
- HUD (HP/XP bars, stat line, status chips, revive indicator, floor banner, hotkey bar 9-slot).
- Minimap (toggleable, vision-aware, enemy dots).
- Inventory modal (3×3 grid, smart effect-deriving tooltip, keyboard + touch nav).
- Game Over screen (7-line run stats + score + unlock notification + 1-tap restart).
- Victory screen (foreshadows v0.3).
- Message log (subscribes to 9 combat events).

**Mobile**
- Auto-detected DOM overlay: D-pad + PICK/DOWN/BAG action buttons, 48dp min target.
- Touch handler maps canvas-pixel taps with CSS-scale awareness.
- Inventory canvas-tap support (tap once to select, tap again to use/equip).
- Viewport meta tag locked at 1.0 scale, no zoom; `touch-action: none` to suppress browser gestures.

**Meta-progression**
- 5 unlock tiers (worn dagger → veteran's vigor → lucky charm → map sense → crimson cloak).
- Highscore + run history (rolling 10) + runs_completed / runs_died counters.
- Score formula in `balance.json` for weekly tuning without rebuild.

### Honored from brief

- 15-point self-verify checklist (Section 14) all addressable in playtest.
- File-per-responsibility rule, no file > 300 lines.
- Data-driven content: adding a new item or enemy is JSON-only.
- Zero `TODO: implement later` for v0.1 scope. DialogueSystem is a *complete stub* for v0.5, not a half-implementation.

### Known limitations / honest scope notes

- **Throwables auto-target** the nearest visible enemy in range. Manual targeting reticle planned for v0.2.
- **Equipment slot visualizer** in HUD shows weapon/armor name only — no inline sprite preview yet.
- **Run resume** (save in-progress to localStorage) is scaffolded in `SaveManager` but not yet hooked into GameScene; the title screen has no "Continue" button. Planned v0.2.
- **Settings menu** shows volume but slider isn't draggable yet (read-only); use in-game `+/-` not bound.
- **Hit-pause** on crit is partially expressed via the longer camera-shake window; a true freeze-frame is v0.2.
- **Particle system** is intentionally lightweight (256 cap); will grow in v0.3 with proper VFX.

### Deviations from brief structure

- Added `src/core/GameScene.js` — brief lists scenes loosely; placed in `core/` (orchestration glue) rather than introducing a new `scenes/` folder.
- Added `src/ui/VictoryScreen.js` — brief mentions a Victory state (Section 9.5) but doesn't list the file; mirrored GameOverScreen.
- Expanded item pool from 15 → **48** at user's explicit request. All new items composed from primitive effects already supported by CombatSystem; zero code change required.

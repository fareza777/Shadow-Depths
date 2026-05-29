# Combat & Hero Design Notes

Living design doc for Shadow Depths. Update when balance or hero systems change.

---

## Combat feel — target experience

**Goal:** Every monster fight is tense and memorable. Killing even one enemy should feel earned.

### Hits-to-kill (HTK) targets

| Enemy tier | Player hits to kill | Feel |
|------------|---------------------|------|
| Fodder (bat, rat) | 2–3 | Quick but not instant |
| Standard (goblin, skeleton) | 3–5 | Short struggle |
| Elite / room focus | 6–10 | Mini-duel |
| Boss | 12–20+ | Set piece |

### Player threat

- Early enemies should threaten the player in **2–4 hits** if grouped; single enemy ~4–8 hits to kill player without healing.
- Avoid: 1-hit kills on standard enemies, 6+ weak enemies in one room with no tactics.

### Room composition (spawn design)

| Room type | Share | Contents |
|-----------|-------|----------|
| Duel | ~40% | 1 standard OR 1 elite |
| Pair | ~35% | 2 enemies (e.g. melee + ranged) |
| Pack | ~15% | 3–4 weak (biome-specific only) |
| Ambush | ~10% | 2 near doorway |

### Combat juice (feedback)

- [ ] Enemy HP bar above sprite
- [ ] Kill flash / brief hit-stop on killing blow
- [ ] Log line + gold/XP pop on death
- [ ] Intent icons always visible before enemy turn (`!` melee, `>` ranged, `!!` wind-up)

### Implementation phases

| Phase | Work | Priority |
|-------|------|----------|
| A | Raise early enemy HP/ATK in `data/enemies.json` | High |
| B | Cap early spawns (max 2/room), more duel rooms | High |
| C | HP bar + kill feedback | Medium |
| D | Elite template + spawn every 3–5 floors | Medium |
| E | Wind-up / charge attacks (heavy behavior) | Later |

### Tuning formula

```
HTK ≈ enemyHP / (playerATK - enemyDEF)
```

Example: target HTK 4, player ATK 4, DEF 0 → `enemyHP ≈ 16` for standard fodder on floor 1–3.

---

## Hero system — current state (code audit)

### What differs per hero today

| Layer | Differentiated? | Where |
|-------|-----------------|--------|
| ATK / DEF / DEX | Yes (small spread) | `HERO_DEFS` in `heroSprites.js` |
| Torch radius | Yes (3–8) | same |
| **Starting HP** | **No** — all use `balance.player.startHP` (30) | `Player.js` |
| Active spell | Yes — 8 unique spells | `heroSpells.js` + `SpellSystem.js` |
| Passive / trait | **No** dedicated passives | — |
| Skills on level-up | Shared pool | run skills, not hero-locked |

### Stat spread (starting overrides)

| Hero | ATK | DEF | DEX | Torch | Spell |
|------|-----|-----|-----|-------|-------|
| Vigil | 4 | 5 | 2 | 5 | Bulwark (heal + DEF buff) |
| Hollow | 6 | 3 | 1 | 4 | Siphon (drain + heal) |
| Inquisitor | 3 | 2 | 4 | 7 | Lantern (AoE burn) |
| Reaver | 5 | 4 | 3 | 3 | Bone Storm (AoE + ATK buff) |
| Pilgrim | 2 | 3 | 5 | 8 | Sanctuary (heal + reveal) |
| Warden | 3 | 7 | 1 | 4 | Iron Stand (DEF + slow) |
| Bladedancer | 5 | 2 | 6 | 5 | Echo Strike (3× hit) |
| Echobinder | 4 | 1 | 3 | 6 | Sundering Chord (AoE + freeze) |

### Fairness problems

1. **Same HP for everyone** — Warden (DEF 7) and Echobinder (DEF 1) both start at 30 HP. Tank fantasy is only marginally better per hit, not eHP pool.
2. **ATK spread feels big on paper, small in combat** — Pilgrim ATK 2 vs Hollow ATK 6 on enemies tuned for ~4 ATK → pilgrim takes 2× hits to kill, hollow still 1–2 hits if enemy HP low.
3. **Magic exists but is “one button”** — differentiated, yet select screen emphasizes ATK/DEF/DEX more than playstyle. Cooldown 5–9 turns; without passives, heroes feel like “stats + spell”.
4. **Spell power uneven** — Reaver/Bladedancer scale with `totalAtk()`; others use flat formulas. Can make item stacking favor certain heroes.
5. **No hero-specific weakness** — Inquisitor has best torch but no tradeoff beyond low DEF.

### What is already good

- 8 distinct spell identities (heal, drain, AoE, reveal, slow, multi-hit, freeze).
- Character select shows spell card (`CharacterSelect._renderSpellCard`).
- Torch radius creates real exploration difference (Pilgrim 8 vs Reaver 3).

---

## Hero fairness — design direction

**Principle:** Each hero = **role + passive + spell**, not only ±2 ATK on the same body.

### Recommended: role framework

| Role | Heroes | Identity |
|------|--------|----------|
| Tank | Vigil, Warden | High HP/DEF, sustain, control space |
| Bruiser | Hollow, Reaver | High ATK, trade HP for damage |
| Skirmisher | Bladedancer, Inquisitor | DEX, crit/evasion, target spell |
| Scout | Pilgrim | Vision, avoid fights, sustain |
| Caster | Echobinder | Spell-focused, low DEF, CC |

### Recommended stat changes (starting)

Add **`hp`** to each `HERO_DEFS.stats` and pass through `heroStatOverrides` → `Player` constructor.

| Hero | HP | ATK | DEF | DEX | Rationale |
|------|----|-----|-----|-----|-----------|
| Vigil | 34 | 4 | 5 | 2 | Baseline knight |
| Hollow | 28 | 6 | 3 | 1 | Glass cannon |
| Inquisitor | 26 | 3 | 2 | 4 | Fragile, mobile |
| Reaver | 30 | 5 | 4 | 3 | Balanced bruiser |
| Pilgrim | 28 | 2 | 3 | 5 | Weak melee, utility |
| Warden | 38 | 3 | 7 | 1 | True tank |
| Bladedancer | 26 | 5 | 2 | 6 | Evasion DPS |
| Echobinder | 24 | 4 | 1 | 3 | Mage |

### Recommended: one passive per hero (always on)

Small, readable, no extra button:

| Hero | Passive |
|------|---------|
| Vigil | +1 DEF when below 50% HP |
| Hollow | Heal 1 HP on melee kill |
| Inquisitor | +1 tile vision while standing still (or torch flicker bonus) |
| Reaver | +1 ATK for 1 turn after killing an enemy |
| Pilgrim | 10% chance to not consume a turn when using stairs (or: see chests 1 tile farther) |
| Warden | Reduce incoming damage by 1 (min 1) while adjacent to 2+ enemies |
| Bladedancer | +5% crit per DEX above 4 |
| Echobinder | Spells leave 1-turn slow on hit targets |

### Spell balance guidelines

- **Utility spells** (Pilgrim reveal, Warden slow): slightly longer CD, weaker raw damage OK.
- **Damage spells** (Reaver, Bladedancer, Inquisitor): cap scaling so +ATK gear doesn’t double outpace others.
- **Sustain** (Vigil, Hollow): must not trivialize food/potions — tune heal to ~30–40% of a potion at level 1.
- Show **effective CD in turns** on character select after difficulty modifiers.

### UI / communication

- [ ] Character select: add **ROLE** chip (Tank / Bruiser / …)
- [ ] Show **HP** in stat row (not only ATK/DEF/DEX/TORCH)
- [ ] Vigil screen: hero name from `HERO_DEFS`, not hardcoded “FAJAR” for all
- [ ] First run tooltip: “CAST” button = hero spell

---

## Free-to-play note (product)

Long-term: free first, monetize later (cosmetic / DLC biome). Combat and hero fairness matter more than IAP for retention.

---

## Item & loot system — audit (2026-05-28)

### How it works today (`DungeonGenerator._spawnItems`)

1. **Per floor:** `itemCount = min(8, 5 + floor×0.04)` → 5 items on F1–23, up to 8 on F100. Vault (+2), forge (1 only).
2. **Placement:** random room (includes **spawn room** — unlike enemies), random passable tile, **no tile reservation** (two items can overlap).
3. **Which item:** global `weightedPick` on all defs with `floorMin ≤ current floor`. Weight = `spawnWeight` from `items.json`.
4. **Affixes:** rolled at spawn for slotted gear only (25% none / 30% prefix / 30% suffix / 15% both). Tier gated by depth; vault gets `+12` depth nudge.
5. **Enemy kills:** gold only — **no item drops** from combat.
6. **Boss arena:** 2 guaranteed items at player side.

### Content numbers (`items.json`)

| Metric | Value |
|--------|-------|
| Total defs | 167 |
| Types | consumable 34, weapon 39, armor/helm/legs 44, ring/necklace 30, throwable 12, passive 8 |
| Rarity | common 31, uncommon 42, rare 57, epic 37 (no legendary base defs) |
| `spawnWeight: 0` | 1 item (`worn_dagger`, floorMin 99 — meta only) |

### Floor 1 drop pool fairness (weighted)

| Type | Share of rolls |
|------|----------------|
| Consumable | **~35%** |
| Weapon | ~22% |
| Armor | ~10% |
| Throwable | ~11% |
| Helm / ring / legs / necklace | ~3–8% each |

**Issue:** Over 1 in 3 floor drops is a potion on early floors → slow build variety; bad RNG = “all heal, no upgrade.”

### Stat progression (weapons)

| Depth | ATK range (examples) |
|-------|---------------------|
| floorMin 1 | 2–4 (+ iron sword 3 weight 8) |
| floorMin 2–3 | 4–6 |
| floorMin 5+ | up to 6+ |

Armor DEF floor 1–3: 1–5 (`plated_mail` DEF 5 can appear from floor 2).  
Affixes add +1–3 ATK/DEF on top — vault items can spike early.

Potion heals: minor 15, standard 30, greater 70 — reasonable vs ~30 HP start.

### Is random-on-floor OK?

**Yes for roguelike**, but **pure random scatter is not enough** and current impl has fairness gaps.

| Approach | Verdict |
|----------|---------|
| Random items on floor (current) | Good base — exploration, replay |
| Only random, no structure | **Weak** — RNG streaks, spawn room clutter |
| Fixed loot tables per chest | Good supplement |
| Enemy drop chance | Recommended add-on |
| Shop / forge only gear | Already partial (forge floor) |

### Fairness issues found

1. **Spawn room can get loot** — enemies excluded, items not.
2. **No per-floor consumable cap** — can roll 5 potions.
3. **No guaranteed “progress” drop** — bad seed = no weapon all floor.
4. **Low density** — 5 items / 6–10 rooms ≈ empty feel; all loot in wrong wing = feels unfair.
5. **Affix tier on vault** with +12 depth on floor 10 can outscale combat tuning.
6. **Enemy loot = gold only** — fighting doesn’t reward gear directly.

### Recommended model (hybrid)

```
Floor loot = structured random (not pure chaos)
```

| Layer | Rule |
|-------|------|
| **Baseline** | 3–5 random floor drops (current), exclude spawn room + stairs tile |
| **Pity** | At least 1 drop is weapon OR armor (not consumable/throwable) |
| **Cap** | Max 2 consumables from floor gen per floor |
| **Elite room** | +1 guaranteed gear drop (when elite spawn added) |
| **Vault** | Chest cluster (2–3 items one room) + affix bias (keep) |
| **Forge** | Craft materials / reroll, not random gear (keep sparse) |
| **Combat** | 5–15% chance low-tier consumable OR gold+small item on kill (elite 100%) |

### Spawn weight tuning (direction)

- Lower `spawnWeight` on `minor_healing_draught` (12 → 6), keep `health_potion` ~8.
- Slightly raise mid weapons on floorMin 2–3 when HTK increases.
- Add `lootCategory` tag in JSON: `consumable | gear | throwable | material` for table rolls.

### UI / feel

- [ ] Show item name on ground (dim label) or ping on minimap
- [ ] Loot toast already exists — keep for upgrades
- [ ] Identify/rarity color on floor tiles (optional)

---

## Forge floors — audit (2026-05-28)

### When & where

| Rule | Value |
|------|--------|
| Forge floor schedule | **Floor 7, 17, 27, 37…** (`floorNumber % 10 === 7`) |
| Not forge | Floor 3 is a **normal** combat floor |
| Enemies on forge | **0** (sanctuary) |
| Floor loot | **1** random item only |
| Entry bonus | Full heal (same as rest) |
| Open smith | Stand on stairs tile → **PICK** (no item underfoot) |
| Uses per visit | **1 craft only** then smith leaves (`_forgeUsed`) |
| Offers shown | **3 random recipes** from full pool |

HUD shows `⚒ FORGE`. World motif at stairs: **anvil + animated flame** (torch-like fire), orange glow.

### What forge is supposed to do

**Design intent:** Pause combat, reward run with **one guaranteed gear upgrade** (affixed weapon/armor/ring) using **materials** collected during the run.

Flow:

1. Kill enemies → **12% chance** drop **biome-tagged material** (not in bag slots — **material pouch**).
2. Reach forge floor → PICK opens **The Veiled Smith**.
3. Pick **one** of 3 recipes → pay materials → receive new item (or reroll affixes on existing gear).

### Why it feels broken (“3 item tidak bisa di-forge semua”)

This matches code — **by design you can only craft ONE**, but UI implies three shops:

| Problem | Why it hurts |
|---------|----------------|
| **3 random offers, not 3 crafts** | Two rows greyed out forever — feels like bug |
| **Offers ignore your pouch** | `chooseForgeOffers` shuffles all recipes with `floorMin ≤ floor`; **no `floorMin` in recipes.json** → endgame recipes can appear on floor 7 |
| **Materials are biome-locked** | Crypt biome drops `scrap_iron` + `crypt_dust` only; **`crypt_dust` is in zero recipes** |
| **Rare mats need other biomes** | `ember_dust`, `frost_thread`, `void_essence` drop only in later biomes |
| **12% drop rate** | Easy to arrive at forge with 0–2 scrap, offer wants 3× void + 4× bone |
| **No farming on forge floor** | 0 enemies → cannot grind materials on the spot |
| **Reroll recipe** | Needs **3× void_essence** + equipment in bag — often impossible early |

Example floor-7 crypt run pouch: `Scrap Iron ×2` → offers might be `Weave the Choir Sigil` (3 void), `Re-roll` (3 void), `Forge Executioner` (2 void + 4 bone) → **0/3 craftable**.

### Recipe material reference (all 14 recipes)

| Recipe | Materials | Notes |
|--------|-----------|--------|
| Forge Keen Edge | 3 scrap_iron, 1 ember_dust | Best early crypt target |
| Reinforce Plate | 2 scrap_iron, 2 bone_shard | Needs bone biome |
| Anoint Ember | 3 ember_dust | Magma/sands biome |
| Re-roll Sigils | 3 void_essence | + worn equipment |
| Weave Frost Mail | 3 frost_thread, 2 bone | Frozen halls |
| … | void, sap, ember mixes | Mid/late |

### Material ↔ biome (drops only from matching biome kills)

| Material | Biomes |
|----------|--------|
| scrap_iron | forgotten_crypts, iron_stronghold |
| crypt_dust | forgotten_crypts (**unused in recipes**) |
| bone_shard | bone_garden, drowned_catacombs |
| ember_dust | magma_foundry, sun_cursed_sands |
| frost_thread | frozen_halls |
| void_essence | void_sanctum, mirror_vaults |
| verdant_sap | sunken_forest |

### Torch / flame visual (forge motif)

Current: shared **campfire flame** for rest + forge; forge adds small **anvil** under flame at `stairsUp`.

| Floor type | Recommended visual |
|------------|-------------------|
| **Rest** | Campfire ring, soft glow, no anvil |
| **Forge** | **Wall brazier / standing torch** (iron pole + bowl fire), **anvil** to the side, ember particles — reads “smithy” not “healing camp” |
| **Vault** | Chest + coin glint (already distinct) |

Avoid identical flame for rest and forge — players confuse safe heal vs craft menu.

### Torch as **item** (not just hero stat)

Today:

- **Torch radius** = hero stat + biome default (lighting fog).
- **Scroll of Mapping / Foresight** = `revealFloor` (whole map, not light radius).
- **Lantern Sap** = heal 24 — **misleading name**, not light.
- **Torchmilk** = heal 36 — lore mentions glow, **no torch effect**.

No consumable temporarily raises `torchRadius`.

### Recommended fixes (forge)

| Priority | Change |
|----------|--------|
| P0 | `chooseForgeOffers`: **≥2 of 3 offers must be craftable** with current pouch OR craftable using **current biome** mats |
| P0 | On forge enter: **grant forge stipend** — e.g. `2× scrap_iron + 1× biome material` for crypt |
| P0 | UI: **“Choose ONE bargain”** bold; grey rows labelled **“Need: …”** not dead “CRAFT” |
| P1 | Add `floorMin` per recipe; filter offers by depth |
| P1 | Use **crypt_dust** in a recipe (e.g. cheap def charm) or stop dropping it |
| P1 | Raise material drop to **18–20%** OR guaranteed 1 mat every 5 kills |
| P2 | Optional 2nd action: **reroll only** vs **new item** (still one visit) |
| P2 | Forge-only: spawn **material pile** (1–3) on ground instead of random gear |

### Recommended torch items

| Item | Effect |
|------|--------|
| **Torch** (consumable) | +2 torch radius for **30 turns** |
| **Flare** (throwable) | Reveal **room** + light 5 tiles 10 turns |
| **Lantern Oil** | Rename/heal OR split: small heal + **+1 radius 20 turns** |
| **Brazier** (forge-only pickup) | Place on tile: permanent **+1 light** in that room (optional) |

Keep **Mapping scroll** as full-floor reveal (rare). Keep hero torch stat differences (Pilgrim 8 vs Reaver 3).

---

## Changelog

| Date | Note |
|------|------|
| 2026-05-28 | Forge audit: offers vs materials, torch motif & item ideas |
| 2026-05-28 | Item/loot audit: spawn rules, fairness, hybrid recommendations |
| 2026-05-28 | Initial doc: combat HTK targets, hero audit, fairness recommendations |

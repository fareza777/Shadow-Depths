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

## Changelog

| Date | Note |
|------|------|
| 2026-05-28 | Initial doc: combat HTK targets, hero audit, fairness recommendations |

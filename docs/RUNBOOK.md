# Shadow Depths — Runbook

Mobile-first roguelike, will ship to **Google Play Store** via Capacitor wrap.
This runbook covers: first run, mobile playtest, troubleshooting, and the
exact path from v0.1 → v0.2 (Play Store internal track).

---

## 1. First Run (Desktop)

```bash
cd "D:\Game Playstore\shadow-depths"
npm install      # ~30 s, only Vite + ESLint
npm run dev      # → http://localhost:5173
```

Open the URL in any modern browser. You should see:

1. Animated title screen with drifting particles.
2. `NEW RUN` → fade into Floor 1 "The Forgotten Crypts".
3. Player visible (light grey humanoid), enemies on visible tiles.

**If `npm install` errors**: delete `node_modules/` and `package-lock.json`, rerun. The whole tree is two dev-deps — anything else is environmental.

**If the page loads black**: open DevTools → Console. Boot errors are also rendered into `#game-root` as a readable stack trace. Usually a missing JSON file in `data/` (typo in a recent edit).

---

## 2. Mobile Playtest (Same Network)

Vite is already configured with `server.host: true`, so the dev server listens on your LAN.

1. Find your dev machine's LAN IP:
   - Windows PowerShell: `(Get-NetIPAddress -AddressFamily IPv4 | Where-Object PrefixOrigin -eq 'Dhcp').IPAddress`
   - or check `ipconfig` for the IPv4 of your active Wi-Fi adapter
2. Run `npm run dev` and watch the console — Vite prints the LAN URL automatically (e.g. `http://192.168.1.5:5173`).
3. On your phone, **on the same Wi-Fi**, open Chrome/Safari and navigate to that URL.

**If the phone times out**: Windows Firewall is blocking. Allow `node.exe` (or `vite`) for Private networks in Windows Defender → Firewall → Allow an app.

You'll see:
- D-pad bottom-left (semi-transparent so it doesn't hide the map).
- Stack of `PICK / DOWN / BAG` buttons bottom-right.
- HP/XP/stats top-left, floor name top-center, minimap top-right.

The canvas auto-scales to viewport.

### Mobile-Specific Controls

| Want to… | Do this |
| --- | --- |
| Move | D-pad arrows |
| Attack | D-pad toward the enemy (auto-attacks on contact) |
| Pick up an item underfoot | `PICK` button |
| Descend stairs | `DOWN` button (only works while standing on `>`) |
| Open inventory | `BAG` button |
| Use a potion / equip a sword from inventory | **Tap the slot once to select, tap again to use/equip** |
| Close inventory | Tap outside the slot grid OR `BAG` again |
| Throw a poison vial / bomb | Inventory → tap slot twice → game auto-targets nearest visible enemy in range |
| Wait one turn | D-pad center dot `·` |

### Things to Verify on Mobile

- [ ] D-pad responds within 50 ms (no input lag).
- [ ] Inventory modal taps are accurate (50–60% of slot area should reliably register).
- [ ] No browser zoom / pull-to-refresh / address-bar resize during play.
- [ ] Battery drain reasonable — should be <2 %/hour of active play; if higher, check whether `requestAnimationFrame` is being throttled (background tab pause).
- [ ] Audio plays after first tap (Web Audio policy).

---

## 3. The Self-Verify Checklist (from Brief, Section 14)

Run through these by hand once per significant change:

1. `npm install && npm run dev` boots clean. ✓ if no console error.
2. Restart 3 times — dungeon layout differs (BSP is seeded per run).
3. Kill an enemy → XP rises, message log updates, damage number floats.
4. Reach next XP threshold → level-up arpeggio, HP/ATK/DEF rise, current HP heals 30 %.
5. Pick up identical potions → stack merges in same slot.
6. Hotkey 1–9 on desktop → that slot's item is consumed and applies its effect.
7. Equip a weapon → ATK in HUD increases.
8. Die → Game Over screen lists what killed you; high score persists across refresh.
9. Resize browser to 375×667 → D-pad appears, all action buttons reachable.
10. Try all 15 original items at least once for full-coverage smoke test.
11. Each of the 5 enemies visibly behaves differently (Bat erratic, Archer kites, Golem skips turns).
12. Refresh after a death — high score still there in localStorage.
13. Add a new item by editing `data/items.json` only → it spawns on next run with no JS edit.

---

## 4. Common Issues

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Audio context warning on first load | Browser hasn't received a user gesture yet | Tap anything; audio resumes silently on next call |
| Floor renders but enemies invisible | Their tile is outside torch radius. Step closer | Working as intended (vision system) |
| Inventory tap on mobile does nothing | First tap *selects*, second tap *activates* | UX choice — gives you a chance to read the tooltip |
| `Bun npm install` fails on `vite` | Node version too old | Node 18+ required (check `node --version`) |
| Phone can't reach `192.168.x.x:5173` | Firewall / different Wi-Fi network | Allow Node through Windows Firewall (Private) |
| Game freezes after a long run | Particle pool full (you've spammed bombs) | Pool auto-trims at 256; close + reopen if persistent |
| BSP generates one tiny room | Bad RNG seed | Restart; rare edge case in the generator (planned fix v0.2) |
| Stairs not visible | They're in an unexplored area | Use a Scroll of Mapping or just explore further |
| Save data corrupted after update | Schema bump didn't migrate | Open DevTools → Application → Local Storage → clear `shadowdepths_*` keys, then refresh |

---

## 5. Next Steps — Path to v0.2 (Play Store Internal Track)

**Single goal of v0.2**: APK installable on your phone via Google Play internal testing track. Nothing else.

### 5.1 — Wrap with Capacitor (1 day)

```bash
cd "D:\Game Playstore\shadow-depths"
npm install -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init "Shadow Depths" "com.fajar.shadowdepths" --web-dir=dist
npm run build           # builds to ./dist
npx cap add android     # creates ./android (gradle project)
npx cap copy android
npx cap open android    # opens Android Studio
```

In Android Studio:
- Set `compileSdkVersion = 34`, `minSdkVersion = 24` (Android 7+; covers ~98 % of devices).
- Open `android/app/src/main/AndroidManifest.xml` and add:
  - `android:screenOrientation="sensorLandscape"` if you want forced landscape, or keep default if portrait works (test it — `CANVAS_WIDTH=960, HEIGHT=672` is landscape-aspect).
- Build → Generate Signed Bundle / APK → AAB (Play Console requires App Bundle, not APK).

### 5.2 — Capacitor Adjustments Needed in Code

These are the ONLY code changes you'll need for v0.2:

1. **vite.config.js** — `base` is already `'./'`, so paths work inside the WebView. ✓
2. **`data/*.json` fetch paths** — currently relative (`'data/items.json'`). Capacitor serves from a `file://` scheme, so check the Network tab in `chrome://inspect` first; if it 404s, prefix with the explicit base or use `import` statements.
3. **Hardware back button** — wire a Capacitor `App.addListener('backButton', ...)` to close the inventory modal or pop to title, otherwise it'll exit the app immediately. ~10 lines in `main.js`.
4. **Status bar** — `@capacitor/status-bar` plugin, `StatusBar.setStyle({style: Style.Dark})`.
5. **Keep-screen-on during play** — `@capacitor/screen-orientation` or a small custom plugin; nice-to-have.

### 5.3 — Play Console Setup

1. Pay the $25 one-time Google Play developer fee.
2. Create a new app in Play Console: name "Shadow Depths", category Games / Roguelike.
3. Internal testing track → add yourself as a tester via email.
4. Upload the signed AAB from Android Studio.
5. Fill in mandatory questionnaires (data safety, content rating, target audience).
6. Wait ~30 minutes for Google to process, then install via the testing link on your phone.

### 5.4 — Mobile-Critical Polish Before v0.2 Ships

Things to do BEFORE submitting even to internal track:

- [ ] **Test on the actual target phone** for a full 30-minute run; note every UX friction.
- [ ] **Add a "tutorial first turn" overlay** if `meta.settings.showTutorial === true`. Roguelikes have a learning cliff; one screen of "D-pad to move, BAG for items" cuts day-1 churn massively.
- [ ] **Pause-on-app-background**: when Capacitor emits `appStateChange.isActive=false`, stop the game loop. Currently it'll keep running (and draining battery) when minimized.
- [ ] **Save in-progress run to localStorage** at end of each turn. Title screen gets a "CONTINUE" button. Scaffolding is in `SaveManager`; needs ~20 lines to hook up.
- [ ] **Test landscape vs portrait** — pick one and lock orientation. Mobile players hate accidental rotation mid-fight.
- [ ] **App icon + splash screen** — even for internal testing, the default Capacitor robot logo looks unprofessional. 30 min of work in Photopea / Figma.

### 5.5 — What to Watch For During Solo Playtest

You'll play it yourself, so be honest with yourself about these signals:

- **Do you actually want to start another run after dying?** If "no" → Pillar 3 (Failure as Fuel) is failing. Audit: was the death telegraphed? Could you have seen it coming?
- **Do two runs feel different?** If you're using the same build / strategy every time → Pillar 2 (Build Expressiveness) is failing. Items might be flat upgrades instead of synergistic.
- **Are you ever bored mid-turn?** If yes → Pillar 1 (Decision Density) is failing. Tile movement might be auto-pilotable, vision might be too generous, enemies might not threaten enough.

If any pillar is failing, fix it BEFORE adding content. Section 2.3 of the brief: "Game half-baked yang penuh fitur lebih buruk daripada game sederhana yang solid."

---

## 6. Recommended v0.3+ Priorities (post-Play-Store)

In order, only after v0.2 ships and you've played ≥10 runs on your phone:

1. **Sprite assets** — commission or self-make a 24×24 spritesheet. SpriteRegistry swap is a one-liner per key.
2. **Manual throwable targeting reticle** — directional input chooses target tile instead of auto.
3. **Real audio files** — replace synth SFX with curated SFX (Freesound CC0). Drop into `public/assets/audio/` and AudioManager preloads.
4. **2 more floors** (4 & 5) + boss enemies.
5. **Daily seed** (Section v0.4 trajectory).
6. **Achievements** (subscribe to existing events — zero combat-code change).

---

## 7. Quick Reference — File Map

| Need to change… | Edit |
| --- | --- |
| Item stats / lore / spawn weight | `data/items.json` |
| Enemy HP / behavior / floor pool | `data/enemies.json` |
| Floor name / theme / atmosphere | `data/floors.json` |
| Damage formula / XP curve / unlock thresholds | `data/balance.json` |
| Add a new enemy AI | `src/entities/behaviors/YourBehavior.js` + register in `GameScene.js` BEHAVIORS map |
| Add a new status effect | `src/combat/StatusEffects.js` (registry) + tick branch in `Entity.tickStatusEffects` |
| Change keybinds | `src/config/constants.js` KEYBIND object |
| Replace procedural art | `src/rendering/SpriteRegistry.js` (single function per key) |
| New audio sound | `src/audio/SynthSFX.js` (function-per-sound) |
| New UI screen | New file in `src/ui/`, implement `enter/render/handleInput`, register in `main.js` sceneFactories |

---

*Build slow. Build right. Iterate forever.*

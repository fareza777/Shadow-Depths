# About and Play Store Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bilingual, iron-and-brass About modal with a reliable Google Play rating action to the Shadow Depths title menu.

**Architecture:** Keep the title-menu presentation and input flow inside `TitleScreen`, matching the existing modal pattern. Isolate Play Store URL launching in a small platform module with injected dependencies for deterministic tests, and read the displayed version from `package.json` through a focused app-info module.

**Tech Stack:** Vite 5, Vitest 4, Canvas 2D UI, Capacitor 8, `@capacitor/browser` 8.

## Global Constraints

- Google Play package ID is exactly `com.shadowdepths.game`.
- The rating URL is exactly `https://play.google.com/store/apps/details?id=com.shadowdepths.game`.
- Support both 480×1040 portrait and 800×480 landscape canvases.
- Add all player-facing strings to both English and Indonesian registries.
- Preserve the existing iron-and-brass visual language and standard 40–48 px action heights.
- Do not add review prompts, analytics, forms, social links, or credits pages.

---

### Task 1: Platform-safe Play Store launcher

**Files:**
- Create: `src/platform/playStore.js`
- Create: `tests/playStore.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `PLAY_STORE_URL: string` and `openPlayStore(options?): Promise<'native'|'web'>`.
- `options` accepts `{ platform?: string, browser?: { open({url:string}): Promise<void> }, windowRef?: { open(url:string,target:string,features:string): object|null } }`.

- [ ] **Step 1: Add the Capacitor Browser dependency**

Run: `npm install @capacitor/browser@8.0.0`

Expected: `package.json` and `package-lock.json` include `@capacitor/browser` version `^8.0.0` or `8.0.0`.

- [ ] **Step 2: Write the failing launcher tests**

Create `tests/playStore.test.js` with tests that assert:

```js
expect(PLAY_STORE_URL).toBe('https://play.google.com/store/apps/details?id=com.shadowdepths.game');
expect(await openPlayStore({ platform: 'android', browser })).toBe('native');
expect(browser.open).toHaveBeenCalledWith({ url: PLAY_STORE_URL });
expect(await openPlayStore({ platform: 'web', windowRef })).toBe('web');
expect(windowRef.open).toHaveBeenCalledWith(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
await expect(openPlayStore({ platform: 'web', windowRef: { open: () => null } })).rejects.toThrow('Unable to open Google Play');
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/playStore.test.js`

Expected: FAIL because `src/platform/playStore.js` does not exist.

- [ ] **Step 4: Implement the launcher**

Create `src/platform/playStore.js` using `Capacitor.getPlatform()` and `Browser.open({ url: PLAY_STORE_URL })` for native platforms. For `web`, call `window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer')`; throw `new Error('Unable to open Google Play')` if no window is returned.

- [ ] **Step 5: Run the launcher tests**

Run: `npx vitest run tests/playStore.test.js`

Expected: all launcher tests PASS.

- [ ] **Step 6: Commit the launcher**

```powershell
git add package.json package-lock.json src/platform/playStore.js tests/playStore.test.js
git commit -m "feat: add Play Store rating launcher"
```

### Task 2: About copy and app metadata

**Files:**
- Create: `src/config/appInfo.js`
- Modify: `src/content/i18n.js`
- Modify: `tests/i18n.test.js`

**Interfaces:**
- Produces: `APP_NAME`, `APP_VERSION`, and `APP_PACKAGE_ID` string constants.
- Produces translations for `title.about`, `about.subtitle`, `about.description`, `about.turn_based`, `about.offline`, `about.no_ads`, `about.rate_prompt`, `about.rate`, `about.rate_failed`, and `about.version`.

- [ ] **Step 1: Write failing metadata and localization assertions**

Add tests asserting that `APP_NAME === 'Shadow Depths'`, `APP_PACKAGE_ID === 'com.shadowdepths.game'`, `APP_VERSION` matches `/^\d+\.\d+\.\d+/`, and every new key resolves to non-key text in both `en` and `id`.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run tests/i18n.test.js`

Expected: FAIL because the app-info module and translations do not exist.

- [ ] **Step 3: Implement metadata and bilingual copy**

Create `src/config/appInfo.js` by importing `package.json` and exporting its version alongside the fixed app name and package ID. Add concise English copy (`A turn-based roguelike forged in shadow...`) and natural Indonesian copy (`Roguelike berbasis giliran yang ditempa dalam bayang-bayang...`) plus localized value markers, rating prompt, action, failure feedback, and version label.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/i18n.test.js`

Expected: all metadata and i18n tests PASS.

- [ ] **Step 5: Commit metadata and copy**

```powershell
git add src/config/appInfo.js src/content/i18n.js tests/i18n.test.js
git commit -m "feat: add localized About metadata"
```

### Task 3: Responsive About modal and title-menu integration

**Files:**
- Modify: `src/ui/TitleScreen.js`
- Modify: `tests/workflowAudit.test.js`

**Interfaces:**
- Consumes: `APP_VERSION` from `src/config/appInfo.js`.
- Consumes: `openPlayStore()` from `src/platform/playStore.js`.
- Adds modal state `'about'`, menu item `{ id: 'about', icon: 'i', labelKey: 'title.about' }`, `_aboutLayout()`, `_renderAbout(renderer)`, and `_openRatingPage()`.

- [ ] **Step 1: Add failing workflow audit assertions**

Extend `tests/workflowAudit.test.js` to read `TitleScreen.js` and assert it contains the `about` menu entry, `modal === 'about'` rendering branch, `openPlayStore`, localized About keys, rating hit ID `500`, and existing close ID `99`.

- [ ] **Step 2: Run the audit to verify it fails**

Run: `npx vitest run tests/workflowAudit.test.js`

Expected: FAIL on missing About integration.

- [ ] **Step 3: Add the menu and modal state flow**

Append `ABOUT` after Settings in `MENU`, add `about` to `MENU_LABEL_KEYS`, open it in `_activate`, render it after Settings, and route tap ID `500` to `_openRatingPage()`. Keep modal close behavior on ID `99`, Escape, and Inventory.

- [ ] **Step 4: Render the responsive modal**

Implement `_aboutLayout()` with separate portrait/landscape geometry. Use `_renderIronModalChrome`, `drawInsetCard`, and `drawIronActionButton` to render:

```text
ABOUT
forged for those who descend
SHADOW DEPTHS · v0.2.0
[localized two-line description]
[TURN-BASED] [OFFLINE] [NO ADS]
★★★★★
[localized rating prompt]
[RATE ON GOOGLE PLAY]
[CLOSE]
```

The three value markers use inset-card styling in one row. The rating card uses brass stars and a subtle glow; feedback replaces the prompt temporarily when opening fails.

- [ ] **Step 5: Add hit testing and error feedback**

Map the rating rectangle to ID `500`. `_openRatingPage()` awaits `openPlayStore()`, catches errors, sets localized feedback, and expires it after 2500 ms without closing the modal.

- [ ] **Step 6: Run focused UI tests**

Run: `npx vitest run tests/workflowAudit.test.js tests/workflowSmoke.test.js tests/i18n.test.js tests/playStore.test.js`

Expected: all focused tests PASS.

- [ ] **Step 7: Commit the About UI**

```powershell
git add src/ui/TitleScreen.js tests/workflowAudit.test.js
git commit -m "feat: add About and rate panel"
```

### Task 4: Full verification and Android sync

**Files:**
- Generated by command: `android/app/src/main/assets/public/**`

**Interfaces:**
- Validates the complete feature; produces a synced Android web asset bundle.

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: all test files PASS.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite completes successfully and writes `dist/`.

- [ ] **Step 4: Sync the Android project**

Run: `npx cap sync android`

Expected: Capacitor copies the built web bundle and reports the Browser plugin for Android.

- [ ] **Step 5: Visually inspect both layouts**

Launch the app in portrait and with `?orientation=landscape`; verify no About text or controls clip, stars and brass accents are legible, and every button is reachable by touch.

- [ ] **Step 6: Final diff review**

Run: `git diff --check HEAD~3..HEAD; git status --short`

Expected: no whitespace errors; only intentional generated/untracked files remain.

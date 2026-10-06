# Android Audit Fixes Implementation Plan

> For agentic workers: use focused parallel workers with disjoint files and integrate via test-driven development. User approved the audit findings and explicitly requested implementation plus a test APK.

**Goal:** Fix the approved gameplay/mobile audit defects and deliver an installable Android test APK without publishing to Google Play.

**Architecture:** Preserve the turn-based engine and existing save format compatibility. Repair contracts at inventory, status, snapshot, rendering, and native lifecycle boundaries; keep GameScene integration under one owner.

**Tech Stack:** JavaScript, Canvas2D, Vitest, Vite, Capacitor 8, Android Gradle.

**Spec:** `artifacts/audit-2026-10-06/AUDIT-ANDROID.md`, approved by user on 6 October 2026.

## Global Constraints

- No new gameplay expansion, deployment, Play Store upload, or production-ad test.
- Preserve existing user saves and all unrelated changes.
- Write regression tests first, observe failure, then make minimal fixes.
- Use a separate test application ID; release application ID and signing remain unchanged.
- No real-device FPS claim without a connected Android device.

## Review Focus

- Full bag and partially stackable rewards must never disappear or charge unrewarded gold.
- Frozen player must not bypass skipped turns through spell, consumable, pointer, or interaction input.
- Continue must preserve outstanding skill choices and be idempotent for one-time floor effects.
- Repeated elite restores must not compound multipliers, lose affixes, or lose key ownership.
- Native Back and overlapping ad callbacks must not quit unexpectedly or duplicate fullscreen calls.

## Work packages

- [x] Combat worker: `EnemyTurnRunner`, `CombatSystem`, `SpellSystem`, `heroPassives`, regression tests. Correct canonical status application and skip-turn execution. Follow-up: slow DEX modifiers and depth-aware status revival. Integration: player action guards in GameScene remain parent-owned.
- [x] Persistence worker: `RunPersistence`, `SkillPickerUI`, snapshot tests. Preserve pending offers and enemy metadata. Follow-up: finalized picker mutation autosave and permanent/legacy torch-radius recovery. Integration: floor-entry side effects remain parent-owned.
- [x] Reward worker: `floorEventRuntime`, `floorEvents`, `Crafting`, transaction tests. Inspect `{added, overflow}`, preserve overflow items, consume altar materials exactly. Integration: craft overflow delivery in GameScene remains parent-owned.
- [x] Native worker: `main`, `AdService`, native callback/ad tests. Route Back through modal input; deduplicate fullscreen ads; hide website badge only in native context.
- [x] Parent: GameScene revive/CC/input/Continue/craft integration; GameLoop pacing; Renderer camera/cache and dynamic HUD layering; motion preference handling; corresponding tests. Follow-ups: ambient/offering deaths, exact multi-item pile removal, rejected interaction results, HUD cache invalidation, reduced-motion bob/pulse suppression.
- [x] Parent: version/package test build preparation, asset sync, Android APK assembly, signature/application-ID/asset verification, user test notes.

## Verification contract

For each work package run the newly written regression tests before edits (expected: audited behavior fails), implement the fix, then run focused tests (expected: pass). Before delivery run `npm test`, `npm run lint`, `npm run build`, copy assets via Capacitor, and assemble/verify the Android APK. Independently review the combined diff before delivering.

Concrete regression assertions include: merchant full bag retains 100 gold; lethal spike with charge returns alive and charge 0; frozen enemy cannot damage player until status expires; repeated forge Continue does not add HP/material; pending skill selection survives restore once; a 90 Hz timestamp stream with a 60 FPS render target is no longer limited to 45 FPS; visibility updates reuse cache canvases; Back from crafting never requests quit; duplicate foreground requests issue at most one SDK show.

## Execution decisions

- User's explicit request to implement the already reviewed audit serves as authorization to proceed; no additional feature/spec approval is requested.
- Work is in the existing checkout on dedicated `codex/android-audit-fixes`, preserving Android dependency/signing setup and leaving `main` unchanged. No worktree is created without user preference.
- Generated APK is a separate debug/test installation to protect the Play Store application's data and avoid signing-key conflicts.

## Final verification — 6 October 2026

- `npm test -- --maxWorkers=2`: 443 tests passed across 50 files, after the final gameplay/motion edits.
- `npm run lint`: zero errors and the same eight pre-existing warnings.
- `npm run android:apk:test`: Vite build, Capacitor sync, and Gradle `assembleDebug` successful. The final build includes the last reduced-motion fixes.
- APK: `release/Shadow-Depths-0.2.15-audit-test.apk`, 29,662,741 bytes. Package `com.shadowdepths.game.test`, version `0.2.15-audit-test`, code 215, label `Shadow Depths Test`, Android API 24+.
- APK Signature Scheme v2 verified; signer is the Android Debug certificate, not the release keystore.
- All 21 packaged web assets match Android's native copy; all 19 Vite-produced assets also match current `dist`. The two extra files are Capacitor-generated Cordova bindings. All five compiled sample ad environment values and the native sample App ID were verified.
- APK SHA-256: `558854FC100B8DA5F3F8CFCD109CDA5155593DC7B178B596D031F45D55387B19`.
- Gameplay bundle `index-DkVNvjcD.js` SHA-256: `91BE34CEEF20DD15682F8E2EAFE9E1C1994754A001E5D84383589D0C5DC3692B`.
- Independent reviews covered gameplay integration, reward/persistence paths, installed native SDK contracts, render pacing/cache geometry, and the follow-up skill durability changes. Significant reproduced issues were fixed and regression-tested.
- No Android device was attached at final verification. Physical FPS, touch feel, heating/battery, OS lifecycle and native ad playback remain user acceptance tests. No Play Store upload/deployment, production ad call, or commit was made.

## Subsequent release authorization and submission — 6 October 2026

- After the test APK handoff, the user explicitly requested a production AAB, upload, and publication. That later instruction superseded the initial no-publication constraint for the mobile release; no separate website deployment was requested.
- Production artifact: `release/Shadow-Depths-0.2.15-vc215.aab`, package `com.shadowdepths.game`, version `0.2.15`, code `215`, 22,556,486 bytes. SHA-256: `7B010166BE73B72795112CF38C5B5ACE0BFADB9244A71BB1493F49C1CEE27718`.
- Production build, signature, bundletool validation, native/packaged assets, and live ad identifiers were verified without requesting production ads. The release certificate matched the previous production AAB. Debug/test application resources remain confined to the debug build.
- The existing Production release was submitted with a 100% rollout and unchanged targeted countries. Preview showed no newly unsupported devices and one non-blocking warning about a missing R8/proguard deobfuscation file.
- At submission verification, Play Console displayed `Changes in review` for the sole change `215 (0.2.15)` / `Start full rollout`, with automated quick checks still running. `Managed publishing off` allows automatic publication after successful checks and Google approval. Submission was verified; approval or live availability was not claimed.
- Browser recovery reused the same saved release rather than creating a duplicate. Screenshots and detailed artifact/release notes are retained locally under ignored `artifacts/` and `release/` directories; binaries, signing material, and environment secrets are not repository changes.
- The user then explicitly requested integration and push to `main`. Fresh pre-integration verification passed: 443 tests in 50 files, lint with zero errors/eight existing warnings, and Vite production build. Independent review is required before merging.

# Production 216 Corrections Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. The user explicitly approved correction, push to main, and replacement Production publication; execute without another approval menu.

**Goal:** Eliminate partial level-up saves and incorrect Android Back handling, then integrate the audited fixes and submit a signed replacement AAB.

**Architecture:** Initial skill offers may be emitted inside unfinished XP-item and combat transactions. Mark these notifications as requiring settlement, and flush the finalized state at the end of turn resolution. Standalone selections and rerolls remain synchronously durable. Route CharacterSelect through the existing TitleScreen Escape handling.

**Tech Stack:** JavaScript, Vitest, Vite, Capacitor 8, Android Gradle, Play Console.

**Spec:** User-approved findings in `artifacts/release-2026-10-06/pre-main-review.md` and the current request: fix, push, upload a new AAB, publish.

## Global Constraints

- Preserve saves, package `com.shadowdepths.game`, existing release signing, targeting and declarations.
- No production ad calls, unrelated web deployment, force push, or signing material in Git.
- Version must exceed already submitted code 215; use 0.2.16 / 216 unless Console shows a newer occupied code.
- Submission is not Google approval or verified live availability.
- Existing branch and Android setup are reused; no new worktree or implementation subagent.

## Review Focus

- XP consumables must disappear from the durable save exactly once.
- XP-triggering kills must persist gold, kill XP, kills and vault key together.
- Pending skill choices and standalone rerolls must remain durable and restore unchanged.
- Back must close normal and daily CharacterSelect, then minimize only unobstructed title.
- AAB assets must match the final build, contain production identifiers, and retain the production certificate.

### Task 1: Correct transactional skill persistence

**Files:** `src/ui/SkillPickerUI.js`, `src/core/GameScene.js`, `tests/skillSaveDurability.test.js`.

**Interfaces:** Existing `skill:selectionChanged` keeps `{entity}` for completed user mutations; initial level-up offers additionally carry `deferSave: true`. `GameScene._resolvePlayerTurn()` consumes the pending offer-save request only after the turn is fully settled.

- [x] Add actual Tome of Wisdom and seed-3 Voidtouched keybearer tests, asserting no synchronous save inside level-up and complete durable action state after return.
- [x] Watch both fail against the previous implementation for partial-save assertions, not fixture errors.
- [x] Initial level-up notification uses `_notifySelectionChanged(this.player, {deferSave: true})`; GameScene queues the durable request instead of writing there.
- [x] End-of-turn save flushes when an initial offer-save request is pending; preserve immediate standalone choices/rerolls.
- [x] Run focused persistence tests and full suite; zero failures. Correction committed as `a8e0a4a`.

### Task 2: Correct Android Back routing

**Files:** `src/main.js`, `tests/nativeLifecycle.test.js`.

**Interfaces:** Add `scene.characterSelect` to existing topmost overlay discovery; TitleScreen already handles Escape to hide the picker.

- [x] Add normal/daily picker tests using the booted native composition and real title/picker.
- [x] Watch both fail because picker remains open after native Back.
- [x] Include CharacterSelect in overlay discovery; do not change pending skill behavior or unobstructed gameplay Back.
- [x] Run native lifecycle tests and full suite; zero failures. Correction committed as `a8e0a4a`.

### Task 3: Integrate and publish replacement

**Files:** `package.json`, `package-lock.json`; ignored build/evidence files under `release/` and `artifacts/`.

- [x] Set package and lock root versions to 0.2.16, producing Android code 216.
- [x] Fresh full tests, lint, production build and independent bounded code review before main integration.
- [x] Fetch main, integrate without force, verify merged tree, push and verify remote commit / CI result. CI is an observed pre-existing failure, not claimed green; see ledger.
- [x] Build with existing Java/Android/signing setup; validate bundle manifest, signer, production ad environment and packaged asset hashes.
- [x] Inspect current Production status; use normal Console replacement/new-release workflow without changing targeting/declarations.
- [x] Upload the verified AAB, review release notes, configure 100% rollout and submit changes for review.
- [x] Record the actual Console state and screenshot. Status is Changes in review with quick checks running, not live.

## Execution ledger

- Base commit: `7392b4c`; main was `59a45d8` at the previous verification.
- Pre-flight: persistence and Back have disjoint code interfaces; their tests both consume existing production composition.
- Pre-flight: package version is the single source of Android name/code; artifact verification follows the finalized build.
- The existing approved audit plan's original no-publication constraint was superseded by the user's explicit mobile publication request.
- RED: both real XP transactions failed because an extra durable write occurred inside level-up; both native picker modes failed because Back left the picker open.
- GREEN: focused persistence/native tests passed 29/29 after the first correction. A follow-up refactor pins the urgent save to the explicit end-of-turn boundary, rather than any `_saveRun` call.
- Full-suite run exposed one intentional version-pinning mismatch (446 passed, release checklist expected 0.2.15); the checklist now tracks replacement 0.2.16.
- Production coverage instrumentation is not installed; no numerical coverage claim is made. Real-device gameplay and SDK playback remain unmeasured without an attached Android device.
- Final source verification before commit: 447/447 tests in 50 files passed; lint zero errors/eight unchanged warnings; production Vite build passed with its existing chunk-size warning. Native AAB assembly and vital lint succeeded.
- Both reported findings are corrected and covered by RED-to-GREEN tests. Skill persistence flushes after actual turn resolution; no save-format migration is required.
- Independent review verdict: Ready to merge, no critical/important/actionable minor findings. Six additional memory-only probes passed; reviewer did not claim physical-device or Console validation.
- Main integrated by fast-forward and pushed without force. Remote source commit verified at `a8e0a4ace37b0336dced7a2fdc0e549eae8b58c6`; fresh merged-tree tests passed 447/447 in 50 files (11.98 seconds). A fresh lint run on main also returned zero errors/eight unchanged warnings.
- GitHub CI run 37469646680 failed before build/tests at npm dependency installation: Node 20 is below Capacitor/AdMob's declared 22+ requirement and npm 10 reports absent esbuild 0.28.2 lock entries. The same failure appears on pre-audit main run 34431805603. CI configuration was not expanded into this gameplay release; no remote CI success is claimed.
- Existing Android workflow also reports failure with no jobs on push. It was not dispatched and its legacy signing-generation logic was not used. Production certificate and local artifact verification remain unchanged.
- Final AAB `release/Shadow-Depths-0.2.16-vc216.aab`, 22,556,580 bytes; SHA-256 `609AF8A26D197909182EC28477952BE957B476B5DAF20C6BCDEF43165D6CD474`. Package `com.shadowdepths.game`, name/code 0.2.16/216, min/target API 24/36. Bundletool validation, signer, production ad identifiers and packaged asset hashes passed.
- Play Console: previous 215 was Active. New Production release 12 accepted AAB 216. Preview has zero newly unsupported devices; phone/tablet counts stay 12,320/6,749. All targeted countries retained, rollout 100%, en-US notes verified, one non-blocking missing deobfuscation-file warning.
- Final submission confirmed on 6 October 2026: Publishing overview shows Changes in review, Production 216 (0.2.16), Start full rollout, managed publishing off. Quick checks are running; approval and live availability are not claimed.
- Proof screenshot: `artifacts/release-2026-10-06/production-216-submitted.png` (local ignored evidence). Detailed local artifact/submission record is `release/Shadow-Depths-0.2.16-RELEASE-NOTES.md`.

# About and Play Store Rating Design

## Goal

Add a polished, discoverable About experience to Shadow Depths and give players a clear way to rate the game on Google Play without crowding the existing settings screen.

## Chosen approach

Add one `ABOUT` entry at the bottom of the title menu. Selecting it opens a dedicated iron-and-brass modal. The rating action lives inside this modal instead of becoming a second top-level menu entry.

This preserves the existing menu hierarchy, keeps Settings focused on preferences, and gives the About content enough space to feel intentional rather than administrative.

## About modal

The modal follows the established title-screen visual language:

- hammered iron panel, brass edge treatment, rivets, and inset cards;
- `SHADOW DEPTHS` title and the existing melancholic brand voice;
- current app version sourced from `package.json` through a Vite compile-time constant;
- concise bilingual description of the game;
- three compact value markers: turn-based, offline-first, and no ads;
- a prominent five-star Google Play rating card and `RATE ON GOOGLE PLAY` action;
- the standard iron `CLOSE` action.

The layout is responsive for both the 480×1040 portrait canvas and the 800×480 landscape canvas. Text remains within the modal bounds at the supported normal and large UI scales.

## Interaction

- Keyboard/controller navigation activates `ABOUT` like every other title-menu row.
- Touch hit testing maps the new menu row, rating action, and close action to existing input conventions.
- The rating action opens `https://play.google.com/store/apps/details?id=com.shadowdepths.game`.
- In a Capacitor build, the URL is handed to the platform using Capacitor Browser so the player can reach the Play Store listing reliably.
- In a normal web build, it opens in a new browser tab with safe opener isolation.
- If opening fails, the modal stays open and shows a short localized failure message instead of disrupting the game.

## Localization

All new user-facing labels and descriptive copy are added to the existing English and Indonesian registries. The package identifier and URL remain locale-independent constants.

## Code boundaries

- `TitleScreen` owns the About menu entry, modal rendering, hit testing, and user feedback because all existing title modals follow that pattern.
- A small URL-opening helper isolates native-versus-web behavior and is independently testable.
- Vite exposes the package version as a build-time constant, avoiding duplicated version strings.

## Validation

- Unit tests cover the Play Store URL and native/web opening paths.
- Existing title workflow smoke/audit tests remain green.
- The project passes lint, unit tests, and production build.
- Portrait and landscape layouts are visually checked for clipping and touch-target placement.

## Scope exclusions

This change does not add review prompts, analytics around rating clicks, a custom review form, social links, credits pages, or any Play Integrity integration.

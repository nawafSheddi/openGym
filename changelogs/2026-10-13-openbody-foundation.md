# 2026-10-13: openBody foundation (Phase 1)

openGym was forked as **openBody**, a calisthenics and mobility tracker. This entry covers the foundation; the feature pillars come in later phases (see `docs/superpowers/plans/2026-10-13-openbody.md`).

## What changed

- **Rebrand.**
  - "openGym" became "openBody" in all user-visible text: the UI, 18 locale packs, the API, MCP, the README and the docs.
  - `scripts/rebrand.mjs` does the rename and has tests. It is safe to re-run after cherry-picking an upstream fix.
  - It leaves alone the upstream links, lowercase internal identifiers (`opengym`, `OPENGYM_*`, `gym_state_v1`) and the licence and history files.
  - `frontend/src/config/brand.js` is the single source of truth for the name, the description and the release repo.
- **Update check:** it now looks at the fork's releases (`nawafSheddi/openGym`) instead of upstream's, so openGym releases are never offered as updates.
- **Palette.**
  - The `teal` accent preset was retuned to the brand teal: `#2dd4bf` dark and `#0d9488` light. Both pass WCAG AA for controls, with dark ink.
  - Teal is now the default accent. Profiles that chose green keep it.
  - A new `--skill` amber token was added for skill highlights.
- **Logo:** a new handstand mark (the `logo` icon) on the Login and onboarding screens. The PWA icons (`icon.svg`, 180 and 512 px PNG) and the theme color `#0b1414` were updated.
- **Calisthenics by default.**
  - New profiles start on a built-in "Calisthenics" equipment profile: body weight, pull-up bar, bench, bands, suspension trainer, weighted, ab wheel, roller and stability ball. The library and picker therefore show bodyweight work, not the gym catalogue.
  - Existing states and openGym backups are not changed. The seed is in `freshState()` only.
- **Gym kit hidden:** the Plates and Dumbbells settings sit behind a new "Gym equipment settings" switch (`S.showGymKit`). The settings search follows the same rule.
- **i18n tooling:** `frontend/scripts/add-strings.mjs` adds a translated string batch to all 18 packs at once, with pt-BR going into its overrides. The three new strings are translated into every language.

## Why

The owner wants openGym's full feature set refocused on calisthenics and mobility, for personal use. Hiding instead of deleting keeps weighted calisthenics, and anyone who flips the switch keeps the gym tooling. It also keeps the fork's diff against upstream small where nothing needs to differ.

## Verification

- frontend `vitest run`: 405 files, 5075 tests passed (baseline 5060 + 15 new)
- api `npm test`: 596/596 · mcp `npm test`: 95/95 · `node --test scripts/rebrand.test.mjs`: 4/4
- `check-locales`: 18 locales × 2261 keys in sync · `check-source-strings`: all present
- Browser (375×812): Login, Home (dark and light), Exercises (Calisthenics profile active), Settings → Equipment

# 2026-10-13: openBody content pipeline (Phase 2) and Explore + Workouts (Phase 3)

## Phase 2: content

- **New content in `catalogue/`.**
  - 12 skill ladders (`skills/`).
  - 40 ready-made workouts (`workouts/`): chest, back, shoulders, arms, core, legs and full body at beginner, intermediate and advanced, plus sessions per mobility area.
  - 12 guided mobility flows (`flows/`).
  - 11 flexibility tests with benchmark bands (`assessments/`).
  - 6 programs (`programs/`), including the r/bodyweightfitness Recommended Routine.
  - The 11-area mobility taxonomy (`areas.json`).
  - 43 new exercises (ids 20000 and up).
  - All of it was web-researched by three parallel agents and written in our own words.
- **Validator:** `scripts/catalogue/validate-content.mjs` (11 tests) checks every exercise reference, enum, band order, ladder index and schedule. `validate.mjs` and `build.mjs` refuse broken content.
- **Build output:** `build.mjs` compiles the content to `frontend/src/lib/content/*.js`.
- **Media:**
  - Exercises only point at media that exists (`media-fields.mjs`, 5 tests).
  - New exercises use open media from `catalogue/media-open/`, served by Vite, nginx and the web image.
  - When there is no media at all, the media block is hidden instead of showing a broken image.
- **Licence accuracy:**
  - The Gym visual media is licensed to openGym. The docs and the verbatim in-app attribution say so again, and `rebrand.mjs` now protects those phrases.
  - "Source code" links the fork (AGPL requires the modified source), and upstream is credited beside it.

## Phase 3: Explore and Workouts

- **Explore tab:** the fifth tab is now Explore, with the handstand mark. A shared `DiscoverNav` chip row (`features/discover/`) switches between Explore screens; sections are config.
- **Area filter:** the Library gained an Area filter (`lib/areas.js`, 11 tests). It works from main muscles only, with name rules for the neck, wrists, thoracic spine and ankles. Chest and arm stretches count as shoulder openers. 918 of 999 mobility exercises get an area.
- **Workouts screen:** `features/workouts/` lists the workouts by muscle or by area, with a level filter. Each opens a sheet with the exercise list and prescriptions.
  - **Start now** saves the workout as an ordinary routine tagged `src: 'workout:<id>'` and starts it; later starts reuse that routine.
  - **Add to plan** saves it and opens the routine editor.
  - Logic lives in `lib/workouts.js` (9 tests), and the store path has 3 tests.
- **Translations:** 15 new UI strings, translated into all 18 languages.

## Verification

- frontend 5098/5098 · api 596/596 · mcp 95/95 · script tests 21/21 · `validate.mjs`, `build.mjs --check` and coach assets in sync.
- Browser (375×812):
  - The Workouts list and sheet render. "Start now" opens a "Chest: Beginner" session with 14 sets.
  - Stretching plus Hamstrings narrows the library to 41 exercises.
  - The Explore tab is lit across the Explore screens.

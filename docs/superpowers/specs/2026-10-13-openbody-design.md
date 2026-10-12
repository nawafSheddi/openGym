# openBody: calisthenics & mobility fork of openGym (design spec)

- **Date:** 2026-10-13
- **Status:** Approved in brainstorming, pending written-spec review
- **Branch:** `feat/openbody` on `github.com/nawafSheddi/openGym` (fork of `DuarteSantos8/openGym`, AGPL-3.0)

## 1. Intent

### What the owner asked for
- A full app with everything openGym does, but for **calisthenics and mobility**, named **openBody**.
- **Personal, non-commercial use** by the owner only.
- A **divergent rebrand.** Upstream merges are not a goal; fixes may be cherry-picked by hand.
- Platforms: **PWA + Docker**, self-hosted. The Capacitor Android/iOS shells stay in the repo, untouched and not rebranded.
- Gym world **hidden by default, weighted calisthenics kept.** Barbell/machine exercises are hidden behind a toggle. The plate calculator, bar-weight and dumbbell-inventory UI are removed, and so are the barbell starter plans. Weighted pull-ups and dips, vests and belts stay, with 1RM for those.
- **Library by muscle and area**, plus a **ready-made Workouts collection** per muscle and area.
- Four new pillars: **skill progression trees**, **guided mobility sessions**, **flexibility assessments** and **built-in programs**.
- Keep openGym's layout and components, with a **new palette, logo and copy**.
- Keep the optional **AI coach, retargeted** to calisthenics and mobility.

### Assumptions (stated in brainstorming, not corrected)
- New content is written in English only. Every new UI string still goes through `t()`, so other languages fall back to English.
- "Done" means:
  - the app runs through `docker compose up --build`
  - all existing test suites stay green
  - every new piece of training logic is a pure helper with a co-located test
  - every UI phase has been checked visually in a browser

### Success criteria
1. A new user lands in openBody. The "Calisthenics" equipment profile is active and no barbell or machine exercise is visible unless they choose "Show all equipment".
2. The library can be browsed by muscle and by mobility area. A ready-made workout can be started in one tap or added to the plan.
3. A skill tree shows the current step. Meeting a step's unlock criterion makes the next session prescribe the next variation.
4. A guided mobility flow plays hands-free: countdown, auto-advance, per-side holds, beeps, screen kept awake. It logs as a workout.
5. Flexibility test results can be entered, are charted over time, and tint the body map by benchmark band.
6. Enrolling in a program fills the weekly plan, and Home shows today's session and the program's progress.
7. History, streaks, the heatmap, the fatigue body map, sync, passkeys, backup and import all still work.

## 2. Constraints and context (from the codebase)

- **Stack:**
  - Frontend: React 19 + Vite + Router + Zustand. No TypeScript and no linter, so match the existing style.
  - API: plain `node:http` in `api/server.js`, storing state as JSON files.
  - Data: the whole client state is one store (`frontend/src/store/useStore.js`), persisted to localStorage (`gym_state_v1`) and synced as a single blob to `DATA_DIR/state-<uid>.json`. There is no database and there are no migrations. New keys must read as defaults when absent.
- **Domain logic lives in pure helpers** in `frontend/src/lib/*.js`, each with a `*.test.js` beside it (CONTRIBUTING rule, which we keep).
- **Dependencies stay minimal.** Frontend runtime dependencies stay React, Router, Zustand and the existing Capacitor packages. No new dependencies unless clearly justified.
- **Catalogue:**
  - Source: `catalogue/exercises/<id>.json`, 5,632 real exercises, already including calisthenics (1,012), isometric (183), mobility (372), stretching (466), yoga (109), pilates (62) and rehab (38).
  - Build: `scripts/catalogue/build.mjs` compiles it to `frontend/src/lib/exercises-data.js` and friends. `scripts/catalogue/validate.mjs` holds the allowed field values.
- **Already reusable:**
  - set modes: `reps` / `time` (holds) / `cardio`
  - bodyweight with added load (`isBw`), assisted variations (`isAssisted`), per-side sets
  - RIR/RPE, supersets
  - progression policies `off|linear|greyskull|double|triple|time` (`lib/progression.js`)
  - equipment profiles (`lib/equipment.js`: `activeProfile`, `exAvailable`)
  - focus mode (`views/FocusView.jsx`), body map (`components/BodyMap.jsx` + `lib/body-paths.js`, MIT), recovery model (`lib/recovery.js`)
- **Media license:**
  - **Existing media:** the stills and clips in `catalogue/media/` are Gym visual's, licensed for openGym only. A non-commercial fork may keep them **unmodified at 180 px with the notice**. They must never be fed to AI systems or used as a base for generated media.
  - **New media:** goes in a separate folder with its sources credited.

## 3. Architecture (Approach A: layer onto the existing engine, data-first)

Content is JSON in `catalogue/`, compiled at build time. Logic lives in new pure modules. Screens are vertical feature slices. Nothing gym-specific is deleted unless it is UI that contradicts the product (plates, bars, dumbbell inventory, barbell starters).

```
catalogue/
  exercises/        + ~40–60 new entries (missing ladder steps, mobility drills)
  areas.json        mobility area taxonomy → muscle slugs
  skills/<id>.json  skill ladders
  workouts/<id>.json ready-made sessions per muscle/area
  flows/<id>.json   guided mobility flows
  assessments/<id>.json flexibility tests + benchmark bands
  programs/<id>.json multi-week programs
  media-open/       open/original media for new exercises + SOURCES.md
scripts/catalogue/  build.mjs + validate.mjs extended for the new types
frontend/src/
  config/brand.js   name, tagline, palette refs, icon: single source of truth
  lib/ladder.js, flow-player.js, assessments.js, programs.js, areas.js (+ tests)
  features/
    workouts/   Workouts collection screen
    skills/     Skill tree screen
    flows/      Guided flow player
    assessments/ Test wizard, charts, mobility map
    programs/   Program chooser, enrollment, Home card
```

## 4. Foundation

### 4.1 Rebrand
- **Name and brand config:** user-visible "openGym" becomes "openBody" across UI strings, locales, `index.html`, the PWA manifest, the API (page titles, push copy, audit text), MCP labels, README and docs. `config/brand.js` holds the name and tagline; components read it, and locale strings use the literal name because `check-source-strings.mjs` requires literal `t()` calls.
- **Internal identifiers stay:** storage keys (`gym_state_v1`), cookie names, `DATA_DIR` file names and env var names are unchanged. They are invisible to the user, and renaming them risks data loss.
- **Palette:** the CSS tokens in `frontend/src/index.css` (dark and light) get a teal/cyan accent (around `#2dd4bf`) replacing the green, and a warm amber secondary for skill highlights. Each foreground/background pair must reach WCAG AA.
- **Logo:** an original SVG handstand mark replaces the dumbbell in the login screen, header, favicon and PWA icons (`frontend/public`).

### 4.2 Gym hidden, weighted cali kept
- **Default profile:** a built-in "Calisthenics" equipment profile, active for new users and selectable for existing ones. It includes body weight, pull-up bar, dip bars, rings, parallettes, bands/resistance bands, suspension trainer, weighted vest/belt (`weighted`), and mobility props: roller, stability ball, yoga block/strap where they exist in the equipment vocabulary.
- **Library:** keeps "Show all equipment".
- **Removed from the UI:** the plate calculator and bar-weight UI in `views/Workout.jsx` and Settings, and the dumbbell-inventory settings. `lib/plates.js`, `bar.js` and `dumbbells.js` and their tests stay in place, unreferenced by the UI where possible.
- **1RM and structural balance:** these Stats cards render only when history contains loaded or weighted sets.
- **Starter plans:** `lib/starter.js` barbell plans are replaced by programs (section 5.5).

### 4.3 Content pipeline
- **Validators:** `validate.mjs` gets a schema check for each new content type. Every referenced exercise id must exist and every area id must be in `areas.json`.
- **Build output:** `build.mjs` emits compact modules into `frontend/src/lib/content/` (skills, workouts, flows, assessments, programs, areas). `build.mjs --check` covers them.
- **Area taxonomy (`areas.json`):** `neck, shoulders, thoracic, lower-back, hips, groin, hamstrings, quads-hip-flexors, calves-ankles, wrists-forearms, core`. Each area maps to one or more of the 18 body-map muscle slugs, and to the exercises tagged with it. Tagging is derived by rule from category, target and name keywords, then refined by hand.

### 4.4 Media for new exercises
- **Sources, in order of preference:** openly licensed images (Wikimedia Commons, `yuhonas/free-exercise-db`, wger), then original SVG pose illustrations in one consistent style.
- **Storage:** files go in `catalogue/media-open/`, each credited in `catalogue/media-open/SOURCES.md`. They are served through the same `/exercise-media` path, which needs a resolver change in the vite dev middleware, the nginx config and `Media.jsx`.
- **Gym visual files** are never processed by AI tooling.

## 5. Feature pillars

### 5.1 Library by muscle/area and the Workouts collection (`features/workouts/`)
- **Exercises tab:** an **Area** filter chip row joins body part, type and equipment. The **By muscle** explorer gains a **Mobility** lens, which lists the area's mobility and stretching exercises.
- **Workouts screen:** ready-made sessions grouped by muscle/area and level.
  - Schema: `{ id, name, area|muscles[], level: beginner|intermediate|advanced, goal: strength|skill|mobility|conditioning, minutes, ex: [routine-entry-shaped items] }`
  - Launch target: about 40 workouts. Each major muscle group (chest/push, back/pull, legs, core, shoulders, arms) and each mobility area is covered, at three levels where that makes sense.
- **Actions:**
  - **Start now:** starts a session from a temporary routine, reusing the existing ad-hoc start path.
  - **Add to plan:** copies it into `routines` as an ordinary user routine.

### 5.2 Skill progression trees (`features/skills/`, `lib/ladder.js`)
- **Skill file schema:** `{ id, name, family: push|pull|legs|core|balance, steps: [{ exId, mode: reps|time, target: { sets, reps?|sec? }, unlock: { sets, reps?|sec?, sessions: 2 } }] }`
- **Launch skills (12):** front lever, back lever, planche, handstand, handstand push-up, muscle-up, pistol squat, human flag, L-sit → V-sit, one-arm pull-up, one-arm push-up, dragon flag.
- **`lib/ladder.js`** is pure:
  - `currentStep(S, skill)` derives the step from history: the highest step whose unlock criterion has been met in N sessions, plus 1. A manual `skillOverrides` entry wins.
  - `unlockProgress(S, skill, step)` returns how close you are, for the UI.
  - `nextPrescription(...)` is used by the policy.
- **Progression policy:** a new `ladder` policy is added to `POLICIES` and to `POLICIES_FOR.reps` / `.time`.
  - When the unlock criterion is met, the next session swaps the entry's exercise to the next step's `exId` with that step's starting target.
  - Otherwise it delegates to `time` (holds) or `double` (reps) inside the current step.
  - Routine entries opt in with `ladder: skillId`.
- **Skill tree UI:**
  - Skills list: each card shows progress on its ladder.
  - Per-skill path: the steps as nodes, locked, current or mastered. Each shows best hold/reps, the unlock bar, and a "Mark as achieved" override.
  - Action: "Add current step to a routine".

### 5.3 Guided mobility sessions (`features/flows/`, `lib/flow-player.js`)
- **Flow schema:** `{ id, name, area[], minutes, level, items: [{ exId, sec, perSide?, cue?, transitionSec? }] }`
- **Launch flows (about 12):** morning flow, hip opener, splits prep, pancake, shoulder and thoracic, wrist prep, desk reset, pre-skill warm-up, post-workout cool-down, ankle and calf, lower-back relief, full-body 20.
- **`lib/flow-player.js`** is a pure reducer: `init(flow)`, `tick(state, dtMs)`, `next`, `prev`, `pause`, `resume`, `toWorkout(state)`. Per-side items expand into L and R holds. Transitions are short get-ready countdowns.
- **Player UI** (built on the `FocusView` patterns):
  - full screen: big countdown, exercise media, cue, next-up preview
  - pause/skip/back controls
  - 3-2-1 beeps through the Web Audio API (no dependency)
  - Screen Wake Lock API on the web, with `mobile.js` handling native
- **Persistence:** the in-progress state persists in the store (`active`-style) and resumes after interruption.
- **Logging:** completing a flow logs a normal workout tagged `flow: id`, with `time`-mode entries, so history, streaks, the heatmap and the body map include it.

### 5.4 Flexibility assessments (`features/assessments/`, `lib/assessments.js`)
- **Test schema:** `{ id, name, unit: cm|deg|s, better: higher|lower, sided: bool, instructions[], bands: [{ max|min, label: poor|fair|good|great|elite }], areas[] }`
- **Launch tests (11):** sit-and-reach / toe touch, pancake, front split L/R, side split, wall shoulder flexion, bridge hands-to-feet, knee-to-wall dorsiflexion L/R, deep squat hold, active straight-leg raise L/R, apley/back-scratch shoulder reach L/R.
- **State:** `assessments: [{ id, testId, d, value, side? }]`, absent → `[]`.
- **`lib/assessments.js`** is pure: `bandOf(test, value)`, `latest(S, testId, side)`, `trend(S, testId, side)`, `areaScores(S)` (feeds the mobility map), `due(S, intervalDays = 28)`.
- **UI:**
  - test-day wizard that steps through the selected tests, with instructions and a value input
  - per-test chart using `LineChart.jsx`
  - **mobility map**, where `BodyMap.jsx` is tinted by area band
  - "next assessment due" on Home when enrolled in a program

### 5.5 Built-in programs (`features/programs/`, `lib/programs.js`)
- **Program schema:** `{ id, name, level, weeks, daysPerWeek, description, routines: [{ key, name, emoji, ex: [...] }], schedule: { mon..sun: routineKey|flowId|null }, assessEveryWeeks? }`
- **Launch programs (6):**
  - **Fundamentals:** beginner, 3×/week full body.
  - **Reddit Recommended Routine:** BWF RR, with progressions mapped to ladders.
  - **Skills & Strength:** intermediate, 4×/week push/pull with skill blocks.
  - **Mobility 30:** daily flows for 30 days.
  - **Splits in 60:** front/side split focus.
  - **Hybrid:** 3 strength + 3 mobility days.
- **Enrollment** (`lib/programs.js`, pure): turns a program into routines plus `week`/`dayPlan` entries using the existing plan structures. `program: { id, startedAt }` is recorded and existing routines are untouched.
- **Program chooser:** replaces the starter-plan chooser on Home and Plan.
- **Home program card:** shows the week number, adherence and the next assessment due.

### 5.6 Stats additions
- Skill timeline: steps unlocked over time, and best hold or reps per skill.
- Weekly time under tension (sum of `time`-mode seconds).
- Weekly mobility minutes (flows plus mobility/stretching category entries).
- Assessment trends summary.
- Existing cards keep working. 1RM and structural balance are conditional (see 4.2).

## 6. Integrations
- **AI coach (`api/coach/`):** the system prompt and knowledge are rewritten for calisthenics and mobility (skill ladders, hold progressions, flexibility programming, joint prep), with the brand renamed. Its library-data generation includes the new content. It stays optional and off unless configured.
- **MCP (`mcp/src/tools.js`):** adds `list_skills_progress` and `list_assessments`, both read-only, plus a brand rename.

## 7. Data model and compatibility
- **New store keys:** `skillOverrides: {}`, `assessments: []`, `program: null`. The in-progress flow uses the existing `active` session mechanism or a sibling key `activeFlow: null`.
- **New optional routine-entry field:** `ladder`. Workouts can carry an optional `flow` tag.
- **Compatibility:** all new keys are absent-safe, so old openGym state files and backups load unchanged. No server schema changes.
- **Built-in content** is compiled into the bundle and never copied into user state, except when the user adds a workout or program to their own routines.

## 8. Error handling and edge cases
- **Content references:** bad exercise ids are rejected at build (`validate.mjs`). At runtime, a missing exercise in a ladder or flow renders as "unavailable" and is skipped by the player.
- **Ladder override:** an override beyond the last step is clamped. When the ladder policy has no next step (mastered), it delegates to `time`/`double`.
- **Interrupted flows:** an interrupted flow resumes from the persisted state. A flow abandoned with at least one completed hold can still be saved.
- **Assessments:** values are range-checked per test (e.g. 0–200 cm, 0–180°, 0–600 s), and unit conversion (cm ↔ in) is added to `lib/units.js`.
- **Program enrollment** over an existing plan asks before replacing the schedule and never deletes user routines.

## 9. Testing and verification
- **New unit tests** beside each new pure module:
  - `ladder.test.js`: unlock across sessions, partial sets, override, clamp, policy swap
  - `flow-player.test.js`: tick/advance, per-side expansion, transitions, pause/resume, completion → workout shape
  - `assessments.test.js`: bands, latest/trend, sided tests, due
  - `programs.test.js`: enrollment into week/dayPlan, no clobbering
  - `areas.test.js`: taxonomy mapping
- **Content validation:** `node scripts/catalogue/validate.mjs` and `node scripts/catalogue/build.mjs --check`.
- **Existing suites** must stay green after every phase: `cd frontend && npm test`, `cd api && npm test`, `cd mcp && npm test`, plus the locale checks (`frontend/scripts/check-locales.mjs`, `check-source-strings.mjs`). Brand-text assertions in tests are updated alongside the rebrand.
- **UI verification:** each UI phase is checked in the built-in browser pane at mobile (375×812) and desktop sizes, in dark and light themes.
- **Final:** `docker compose up -d --build`, then a full end-to-end run: sign up with a passkey on localhost, enroll in a program, do a workout, play a flow, log an assessment, check stats.

## 10. Phasing
| # | Phase | Ends with |
|---|-------|-----------|
| 1 | Foundation: rebrand, palette, logo, Calisthenics default profile, gym UI removed, pipeline extensions, areas | suites green + browser check |
| 2 | Content & media, **web-researched** (r/bodyweightfitness wiki + RR, established skill-progression and flexibility-norm sources, open media libraries): new exercises, open/original media, ~40 workouts, ~12 flows, 12 skills, 11 tests, 6 programs | validate/build --check green |
| 3 | Library area filter, mobility lens, Workouts screen | tests + browser check |
| 4 | Skills: ladder engine, policy, skill tree UI | tests + browser check |
| 5 | Guided flows: player engine + UI | tests + browser check |
| 6 | Assessments: wizard, charts, mobility map | tests + browser check |
| 7 | Programs & Home card & onboarding | tests + browser check |
| 8 | Stats, coach, MCP, docs, changelog | all suites green |
| 9 | Docker E2E verification | screenshots + logs |

**Housekeeping:**
- **Commits:** local commits on `feat/openbody` after each verified phase (standing approval from the owner). There is no push without asking.
- **Changelogs and lessons:** changelog entries go in `changelogs/YYYY-MM-DD-*.md`, and lessons learned in `lessons-learned/` with an `INDEX.md`.

## 11. Out of scope (YAGNI)
- Rebranding or testing the Android/iOS Capacitor shells.
- Translating new content beyond English. Keys go through `t()`, so they fall back to English.
- Video recording or form analysis, social features, and leaderboards.
- Renaming internal storage keys or env vars.
- Commercial-license media replacement for the existing Gym visual set.

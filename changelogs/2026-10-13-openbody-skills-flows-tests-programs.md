# 2026-10-13: Skills, guided flows, flexibility tests, programs, stats, coach and MCP (Phases 4–8)

## Phase 4: skill ladders
- **Engine:** `lib/ladder.js` (22 tests).
  - The step you're on is derived from the log: the step after the highest one met in N separate sessions.
  - A step is never downgraded, and a manual "I can already do this" floor is kept in `S.skillOverrides`.
  - Between steps, `applyLadders` swaps a routine entry to the next variation. It runs when a session starts and when one is saved, and shows a "moved up" toast. Within a step, the existing `time` and `double` policies progress.
- **Routine editing** keeps an entry's `ladder` tag.
- **Defaults:** routines created from workouts and programs use double progression for reps and time progression for holds.
- **Screens:** Explore → Skills (cards with progress) and a per-skill ladder (done, current and locked steps, unlock bar, best set, cues, add to a routine).

## Phase 5: guided mobility flows
- **Engine:** `lib/flow-player.js` (18 tests). A timestamp-based state machine with get-ready and hold phases, left/right holds, pause, skip and back, and catch-up after a sleeping phone. It is persisted as `S.activeFlow`.
- **Screens:** Explore → Mobility (12 flows with a preview), and a full-screen player with a countdown ring, beeps, a chime per hold, vibration and wake lock.
- **Logging:** a finished flow is logged as an ordinary workout (timed sets, per-side rows, `flow` tag, volume).
- **Fixed during browser testing,** with regression tests:
  - rapid taps were lost;
  - Skip on the last hold crashed the screen and saved nothing;
  - History showed "NaN kg".

## Phase 6: flexibility tests
- **Engine:** `lib/assessments.js` (14 tests).
  - Bands come from ascending thresholds, ranked by label, so lower-is-better tests rank the same way.
  - A left/right test is rated by its weaker side.
  - Area ranks drive the mobility map, test days fall due on an interval, and imperial profiles see inches.
- **Screens:** Explore → Tests:
  - the mobility map on the body diagram;
  - a test-day wizard;
  - a sheet per test with instructions, bands, trend chart and history;
  - signed values through a ± toggle, because the iOS decimal keypad has no minus key.

## Phase 7: programs
- **Engine:** `lib/programs.js` (12 tests).
  - Enrolling creates ordinary routines tagged `program:<id>:<key>` and sets only the program's weekdays.
  - It never deletes routines, reuses them on re-enroll, and asks before replacing occupied days.
  - Laddered slots start on the skill's current step.
- **Chooser:** the program chooser replaces the barbell starter plans at every entry point.
- **Home card:** week, adherence, a one-tap start for today's mobility flow, a test-day nudge, and leave.
- **Defaults:** new profiles start with the gym check-in card off.

## Phase 8: stats, coach, MCP, docs
- **Stats:** a "Skills & mobility" card (`lib/cali-stats.js`, 4 tests): skills mastered, steps unlocked, mobility band, and 8 weeks of hold vs mobility minutes. The structural-balance card now shows only once loaded work is logged.
- **AI coach:**
  - The prompt is retargeted at calisthenics and mobility: variations over volume, skill ladders, holds, skill work first, tendon care, flows and flexibility tests.
  - The coach payload now carries `ladder`, as do exported plan files. Both used to drop it.
- **MCP:** `list_skills_progress` and `list_assessments` (6 tests).
- **Docs:**
  - README rewritten for openBody, and `CLAUDE.md` gains an openBody architecture section.
  - Docker Compose builds local `openbody-*` images (`pull_policy: build`) instead of pulling upstream's.

## Translations
104 new UI strings across these phases, in all 18 languages. ru/uk/pl get plural forms where a count is shown.

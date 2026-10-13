# 2026-10-13: Whole-branch review fixes and Docker end-to-end (Phase 9)

## Review fixes
A fresh reviewer audited the branch. I reproduced and fixed each confirmed finding with a regression test:
- **Lost workouts.** "Start now" on a ready-made workout replaced a session in progress. It now returns to that session.
- **Phantom holds.** A flow left open logged every remaining hold. Flows now pause when you leave the player and freeze if the page is hidden for more than 2 minutes. A flow reopened long after is settled (`settle()`), not replayed.
- **Double logging.**
  - The timer could finish a flow underneath "End this flow?".
  - A second tab or device could log the same flow again.
  - The running flow now lives on the device only (`features/flows/flow-store.js`). End pauses it, and `finishFlow` logs each run once.
- **Per-side ladders.** 5 + 5 reps cleared a "10 per side" bar. A set is now scored by its weaker side, and promotions onto per-side entries double the rep target.
- **Ladder swaps.** A laddered exercise the user replaced was swapped back. Programs also started beginners on the last step (strict muscle-up). Enrollment now uses the current step exactly.
- **"I can already do this"** now marks the step done. Claiming the last step means mastered.
- **Program week** was off by one across a daylight-saving change. Day counts now round.
- **Sync across devices.** Assessment results and skill floors were lost when two devices edited them. Results now merge by id with tombstones, and floors as a stamped map, mirrored in `api/sync-stamps.js`.
- **Hardening.**
  - An SVG safety validator and a sandboxing CSP on all exercise media.
  - The validator requires all five band labels.
  - Switching programs clears the previous program's weekdays.

## Upstream time bomb
Five API test files pinned their fixtures to July 2026, inside a rolling 12-week window. They started failing on 2026-10-13, identically on pristine upstream (checked in a throwaway worktree). They now pin the date.

## Docker end-to-end
- **Build:** `docker compose up -d --build` builds `openbody-web:local` and `openbody-api:local` from this checkout.
- **Health:** web on :8080 returns 200, and `/api/health` returns `{"ok":true}`. New open-media SVGs are served with the sandboxing CSP.
- **Production run, fresh guest profile:**
  - The Home welcome card offers programs, with no gym check-in card.
  - Fundamentals enrolled, and the program card showed today's mobility flow.
  - The flow played (a real hold, then skipped through) and was saved to History.
  - Knee to wall logged L 11 / R 8 cm as Good and Fair; the test rates Fair overall.
  - Stats showed the mobility band.
  - Explore listed 12 skills, the workouts, 12 flows, and the library filtered to Calisthenics.

## Verification
frontend 5200/5200 · api 596/596 · mcp 101/101 · script tests 22/22 · catalogue validate/build/coach assets in sync.

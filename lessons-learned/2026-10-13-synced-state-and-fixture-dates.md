# New synced state needs a merge rule on both sides; date-pinned fixtures expire

**Date:** 2026-10-13 (whole-branch review of openBody)

## What happened
1. **New keys added to the synced store had no merge rule.**
   - `S.activeFlow`, `S.assessments` and `S.skillOverrides` were simply added to the synced store, so they fell back to whole-key last-writer-wins.
   - A running flow was synced to every device, where a second tab could log it again.
   - A flexibility result logged on one device vanished when the other device synced anything newer.
2. **The server mirrors the client's rules.** When the merge rules were fixed in `frontend/src/lib/sync-merge.js`, a parity test failed. The API keeps a mirror of those rules in `api/sync-stamps.js`.
3. **Upstream's fixtures expired.** Ten API tests started failing on pristine upstream on 2026-10-13. Their fixture history is hard-coded to July 2026, and the coach payload keeps a rolling 12-week window from the real clock.

## Root cause
- The sync layer gives a new key no safe default. Every key needs an explicit decision: synced union, stamped map, per-device, or never synced.
- Fixture dates were literal while the code under test read the real clock.

## Rules
- **For every new state key, decide its sync semantics before shipping:**
  - Device-local playback state (a running timer or flow) never goes in `S`. Keep it in its own persisted store.
  - Lists of user records are a union by id, with deletion tombstones (`DEL_LISTS`, `DEL_TIME`).
  - Per-item choices are stamped maps (`STAMPED_MAPS`, `{ v, _ts }`, a clear is a stamped null).
  - Mirror every change in `api/sync-stamps.js`, and add a two-device `mergeStates` test.
- **A test with literal dates must pin the clock** (`mock.timers.enable({ apis: ['Date'], now })` in node:test, `vi.useFakeTimers({ toFake: ['Date'] })` in vitest), or derive its dates from now.
- **Before concluding a failure is "unrelated", prove it:** run the same test on the pristine base commit in a throwaway `git worktree`.

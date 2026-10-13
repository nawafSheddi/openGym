# 2026-10-13: Passkey and two-device sync end-to-end, CLAUDE.md fix

This run closes the gap left by Phase 9. That end-to-end run used a guest profile, so passkey sign-up and syncing between devices were never exercised against the real server.

## Docs
- **`CLAUDE.md` was out of date.** It said the running guided flow is saved in `S.activeFlow`. The review moved it to the device-local `features/flows/flow-store.js`, and nothing in `frontend/src` reads `activeFlow` any more.
  - Corrected both mentions.
  - Added a line on the rule that every new synced key needs merge rules in `lib/sync-merge.js`, mirrored in `api/sync-stamps.js`.

## End-to-end run (Docker images rebuilt from HEAD, `localhost:8080`)
- **Passkey sign-up.** "Create passkey profile" in the in-app browser, with the owner approving the macOS prompt: `register/options` and `register/verify` both 200.
  - The profile shows "Signed in as E2E Tester · All synced".
  - The guest data moved into the account: program, flow workout and knee-to-wall results.
- **Signed-in changes reach the server.** A Fundamentals A session, an active straight leg raise result (L 75° Good, R 82° Great) and a Back lever "I can already do this" were all on the server. The override was stored as `{ v: 2, _ts }`, and the running flow was not in synced state.
- **Second device.** It was paired through "Pair the mobile app" (`pair/create`, then `pair/redeem` → Bearer token) and acted as an unstamped API client. It:
  - deleted one of device A's results;
  - added its own result;
  - set a Front lever override.

  The server recorded the deletion as a tombstone (rev 7 → 8).
- **Concurrent change.** Device A logged a deep squat result before pulling rev 8. Its push returned `409 Conflict`; it merged, and the retry returned `200` (rev 9). The server and device A ended up identical:
  - both new results kept (union by id);
  - the deleted result stayed deleted, although A still had it locally (tombstone);
  - both skill overrides kept (stamped map);
  - device A's Skills screen shows "Tuck front lever · Step 2 of 6".

## Not covered
- **Passkey sign-in in a browser.** Neither the in-app browser nor the automated Chrome can complete a WebAuthn assertion. Both fail with `NotAllowedError`, even after approval. The branch changed no auth logic, only wording, and sign-in is covered by `api/test/server-passkeys.test.js`.
- **Backup export and import.**

See `lessons-learned/2026-10-13-automated-browsers-and-passkey-signin.md`.

## Verification
frontend 5200/5200 · api 596/596 · mcp 101/101 · catalogue validate, `build --check` in sync (this session, before the run).

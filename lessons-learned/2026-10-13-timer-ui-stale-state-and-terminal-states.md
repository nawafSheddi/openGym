# Timer UI: controls acted on stale state, and a terminal state crashed the screen

**Date:** 2026-10-13 (guided-flow player, `features/flows/FlowPlayer.jsx`)

## What happened
1. **Lost taps.** Rapid taps on Skip advanced only one step. Each tap computed its new state from `live`, a value captured at the last render, so taps landing before React re-rendered repeated the same transition.
2. **Crash on the last step.** Skip on the final hold saved the *finished* state straight to the store. On the next render `tick()` returned that same object, so the "finished" effect bailed out at its `live === st` guard and never logged the workout. The render then read `step.exId` from a finished state, where `step` is null, and crashed into the error boundary.
3. **"NaN kg" in History.** The flow's saved workout had no `vol`, which the normal finish path always sets.

## Root cause
- Event handlers closed over render-time state instead of reading the source of truth at event time.
- Completion was detected as "the state changed into done". A state can *arrive* already done, and that path was missed.
- A new write path into `S.workouts` skipped a field that every reader of that list assumes.

## Rules
- In timer or real-time UIs, handlers read the latest state from the store (`useStore.getState()`) at event time, never from a render closure.
- Detect terminal states by **is-done**, not **became-done**, and guard every render path that dereferences per-step data.
- When adding a new writer to an existing collection (`S.workouts`), copy every field the normal writer sets (`vol`, `flow`, …) and assert them in a test.
- Always run a new interactive feature end to end in the browser through its terminal state. All three bugs passed the unit tests.

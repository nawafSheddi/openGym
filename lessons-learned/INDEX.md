# Lessons learned

- 2026-10-13 · [Parallel agents deleted each other's shared exercises](2026-10-13-parallel-agents-shared-resources.md): give shared resources one owner before dispatching parallel agents
- 2026-10-13 · [zsh word-splitting and globs](2026-10-13-zsh-word-splitting-and-globs.md): quote globs and paths; use xargs instead of `$VAR` lists
- 2026-10-13 · [Timer UI stale state and terminal states](2026-10-13-timer-ui-stale-state-and-terminal-states.md): handlers read the store at event time; detect is-done, not became-done; copy every field a collection's writer sets
- 2026-10-13 · [Synced state and fixture dates](2026-10-13-synced-state-and-fixture-dates.md): every new state key needs explicit sync semantics mirrored in api/sync-stamps.js; literal-date tests must pin the clock

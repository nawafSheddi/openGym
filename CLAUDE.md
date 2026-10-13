# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

openBody is a self-hosted **calisthenics and mobility** tracker PWA, a divergent fork of openGym
(github.com/DuarteSantos8/openGym, AGPL-3.0). Two containers (`api` + `web`) plus a `./data` folder
the user owns: no third-party account, no telemetry. Passkey (WebAuthn) login, installable as a
home-screen app. Capacitor shells for Android/iOS exist but are not maintained in this fork.
Design spec and plan: `docs/superpowers/specs/2026-10-13-openbody-design.md`,
`docs/superpowers/plans/2026-10-13-openbody.md`. Changelogs: `changelogs/`. Lessons: `lessons-learned/`.

## openBody on top of openGym (read this first)

- **Content is data** in `catalogue/`: `skills/` (12 ladders), `workouts/` (40), `flows/` (12 guided
  mobility flows), `assessments/` (11 flexibility tests), `programs/` (6), `areas.json` (11 mobility
  areas), new exercises with ids >= 20000. `scripts/catalogue/validate-content.mjs` checks every
  reference; `build.mjs` compiles it to `frontend/src/lib/content/*.js`. Run
  `node scripts/catalogue/validate.mjs && node scripts/catalogue/build.mjs` after any content edit.
- **New pure logic** (each with a test beside it): `lib/ladder.js` (skill step derived from the
  log; `applyLadders` swaps a routine entry to the next variation; runs at session start and
  finish), `lib/flow-player.js` (timestamp-based flow state machine; the running flow is
  device-local in `features/flows/flow-store.js`, never in `S`, so a second tab/device can't log it twice),
  `lib/assessments.js` (bands, trends, mobility map), `lib/programs.js` (enroll → ordinary routines
  + `S.week` days, never deletes routines), `lib/workouts.js`, `lib/areas.js`, `lib/cali-stats.js`.
- **New screens** are vertical slices in `frontend/src/features/<name>/` (discover, workouts,
  skills, flows, assessments, programs, stats). The Explore tab hosts them via `DiscoverNav`.
- **New state keys are absent-safe** (old openGym states load unchanged): `skillOverrides`,
  `assessments`, `program`, `showGymKit`. New-profile defaults go in `freshState()`,
  never in `DEF` (Calisthenics equipment profile, teal accent, check-in off). Every new synced
  key needs merge rules in `lib/sync-merge.js` mirrored in `api/sync-stamps.js` (`assessments`:
  union by id + tombstones; `skillOverrides`: stamped map).
- **Every UI string** goes through a literal `t()` and must exist in all 18 locale packs: add a
  translated batch with `node frontend/scripts/add-strings.mjs <batch.json> --section "..."`.
- **Brand**: `frontend/src/config/brand.js`. Re-run `node scripts/rebrand.mjs <paths>` after
  cherry-picking upstream code (it protects upstream links and the media-licence wording).
- **Media**: `catalogue/media/` is Gym visual's, licensed to openGym (non-commercial fork keeps it
  unmodified). Never edit it or feed it to AI tools. New exercises use `catalogue/media-open/`
  (credited in `SOURCES.md`), served under the same `/exercise-media/` paths.
- Docker builds local `openbody-*:local` images (`pull_policy: build`); upstream ghcr.io images
  are a different app.

## Project layout

```
frontend/  React 19 + Vite app (src/views, src/components, src/store, src/lib). Builds to static files.
           android/ + ios/ are the Capacitor shells for the standalone mobile app (docs/MOBILE.md).
api/       backend — server.js (Node, no framework), deps: @simplewebauthn/server, web-push.
           coach/ is the optional AI coach; openapi.yaml documents every route.
web/       multi-stage Dockerfile (builds frontend → nginx) + nginx.conf.template (serves app, proxies /api).
mcp/       optional MCP server — read-only stdio bridge exposing a user's workouts/1RM/muscle
           balance to LLM clients (Claude Desktop, Cursor…). Not part of the Docker build; only
           runs when an LLM client spawns it.
media/     exercise img/gif, gitignored, fetched at runtime by the `media` compose service.
website/   static project site (plain HTML/CSS/JS), deployed separately.
kubernetes/ example manifests (docs/SELF_HOSTING_KUBERNETES.md).
docs/      guides indexed in docs/README.md (FAQ, SELF_HOSTING*, MOBILE, AI_COACH, DATA_IMPORTS, API);
           docs/dev/ holds feature design notes (SET_TYPES: drop sets/rest-pause, LIST_VIEW, COMBINE_ROUTINES).
```

## Commands

```bash
# Local stack (api + web + media, prebuilt or built from source)
cp .env.example .env
docker compose up -d --build

# Frontend dev server (hot reload), proxies /api to :3000
cd frontend && npm install && npm run dev

# Frontend tests (training logic: progression, 1RM, session read-back)
cd frontend && npm test            # vitest run
cd frontend && npm run test:watch
npx vitest run src/lib/progression.test.js   # single file
npx vitest run -t "some test name"           # single test by name

# API and MCP server tests
cd api && npm test
cd mcp && npm test

# Production build
cd frontend && npm run build
cd frontend && npm run build:mobile   # + cap sync, points media at the CDN dataset
```

There is no linter/formatter configured (no ESLint/Prettier config in the repo) and no
TypeScript — match the existing style by hand.

GitHub (`github.com/DuarteSantos8/openGym`) is the home of the project; `.github/workflows/mirror.yml`
pushes `main` and `v*` tags to the GitLab mirror. Pull requests are gated by
`.github/workflows/test.yml` on Node 22 — the same version as `web/Dockerfile` / `api/Dockerfile`
(`node:22-alpine`): the frontend, api and MCP suites, the locale checks, and building and booting
both api image targets. GitLab CI on the mirror (`.gitlab-ci.yml`) builds the release artifacts:
the signed Android APK, the multi-arch images and the SBOMs. Never push or merge on GitLab
directly; the mirror is fast-forward only.

## Architecture

### Frontend (`frontend/src`)

- **`store/useStore.js`** — single Zustand store holding the entire client-side app state (`S`),
  persisted to `localStorage` (`gym_state_v1`) and debounce-pushed to the server when signed in
  (`pushState`, see `lib/api.js`). On the Capacitor mobile build it's also mirrored to a file via
  `lib/mobile.js` (`nativeSave`), since WebView storage can be evicted. `store/useUI.js` holds
  ephemeral UI state (modals, active sheet, etc.) separately from persisted data.
- **`lib/`** — pure, framework-free helpers, each paired with a same-directory `*.test.js`. This
  is where the domain logic lives, most importantly:
  - `progression.js` — the progression-rule engine (linear, Greyskull LP, double progression,
    time-based). Rules implement a shared policy interface; adding a new one plugs in here.
  - `onerm.js` — estimated 1RM from logged sets.
  - `finish-workout.js` — reduces a completed session back into state (weights advance, PRs, etc).
  - `recovery.js` / `recovery-view.js` — fatigue/muscle-recovery model.
  - `workout-model.js`, `supersetFlow.js` — in-session workout state machine, incl. supersets.
  - `exercises.js` / `exercises-data.js` — the exercise library (1,324 built-ins + user-defined).
  - `api.js` — the only place that talks to the backend (`fetch` wrapper, session cookie flows).
  - CONTRIBUTING.md is explicit: **anything that decides what you lift next, or reads a logged
    session back, is a pure helper here with a unit test beside it** — not verifiable by
    clicking, and the progression engine has already had two bugs that only a test caught.
- **`views/`** — one file per screen (Home, Workout, Plan, Library, Stats, History, Settings,
  Admin, Login, RoutineEdit), routed by `react-router-dom` from `App.jsx`.
- **`components/`** — shared UI (charts, modals, timers); `instr/` holds per-language exercise
  instruction text; `locales/` is the i18n string catalogue (`lib/i18n.js` / `i18n-core.js`).
- Mobile: `@capacitor/*` wraps the same web build into native shells under `frontend/android` and
  `frontend/ios` (see `docs/MOBILE.md`); `mobile.js` in `lib/` gates native-only behavior (file
  persistence, local notifications, wake lock) behind a `MOBILE` flag.

### API (`api/server.js`)

Single file, no framework, plain `node:http`. Requests are dispatched through a `routes` object
keyed by `'METHOD /path'` (e.g. `routes['GET /api/health']`) matched against `req.method + ' ' +
url.pathname` — add a new endpoint by adding a key here. State is two flat JSON files under
`DATA_DIR` (`db.json`: users/credentials/subscriptions/invites; `state-<uid>.json`: per-user
workout data), written with a write-temp-then-rename atomic pattern (`atomicWrite`). Auth is
WebAuthn passkeys (`@simplewebauthn/server`) plus a signed session cookie (HMAC'd with a
`DATA_DIR/secret` generated on first boot) — no JWT/session-store dependency. Optional pieces
gated by env vars: `ADMIN_UIDS` (admin dashboard), `INVITE_ONLY` (signup needs a code),
`ALLOW_GUEST` (client-only guest mode never hits the server at all), plus a rotating
`data/audit.log` (JSONL) for sign-in/admin events. Web Push (`web-push`, VAPID keys
auto-generated into `data/vapid.json`) drives rest-timer-over and day-reminder notifications.

### MCP server (`mcp/src`)

Read-only stdio MCP bridge (`@modelcontextprotocol/sdk`) that lets an LLM client read a single
user's routines/workouts/body-weight/1RM/muscle-balance directly from the same `DATA_DIR` the API
writes to — no network call, no extra container. `state.js` loads/derives the data, `tools.js`
defines the exposed MCP tools (zod-validated schemas), `labels.js` maps internal keys to
human-readable labels, `index.js` wires it together. See `mcp/README.md` for the client-config
side (Claude Desktop / Cursor).

### Passkeys and self-hosting constraints

WebAuthn passkeys are bound to an exact hostname (`RP_ID`) and require HTTPS (localhost excepted)
— this shapes a lot of the API and Settings code (`RP_ID`/`ORIGIN` env vars, guest-mode fallback
when neither is available). Read `docs/SELF_HOSTING.md` before touching auth, session, or
notification code; it documents the exact env-var contract (`RP_ID`, `ORIGIN`, `PORT`,
`WEB_PORT`, `NGINX_PORT`, `BACKEND`, `SESSION_DAYS`, `ADMIN_UIDS`, `INVITE_ONLY`, `ALLOW_GUEST`,
`AUDIT_*`, `VAPID_SUBJECT`) that real deployments depend on.

### Docker / deploy

`docker-compose.yml` has three services: `media` (one-shot exercise-asset downloader, gitignored
output), `api`, `web` (multi-stage build of `frontend/` served by nginx, which also proxies
`/api` → `api` and serves the shared media volume — single origin, required for passkeys).
`web/nginx.conf.template` is rendered from env vars at container start (`NGINX_PORT`, `BACKEND`,
`PORT`), so host/port remapping works against prebuilt images without a rebuild.

## Guidelines from CONTRIBUTING.md worth knowing before changing code

- **Dependency-light is a hard constraint, not a preference.** Frontend: React + Router + Zustand
  and nothing else. `api/`: two dependencies total. New dependencies are a hard sell either side.
- Don't commit `media/` or `data/` (gitignored).
- Training-logic changes (progression, 1RM, session read-back) need a unit test in `src/lib`
  beside the code, not just manual clicking-through.

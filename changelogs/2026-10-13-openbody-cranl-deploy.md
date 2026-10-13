# 2026-10-13: One-container image for CranL, and a Cloudflare custom-domain proxy

openBody can now run on CranL, a container PaaS, as a single container, at a hostname on the owner's Cloudflare domain. That works on CranL's free plan, which has no custom domains. Guide: `docs/SELF_HOSTING_CRANL.md`. The target instance is `https://body.nawaf.solutions`.

## Why
- **One container.** openBody must be served from one origin, and nginx reaches the api over plain http. CranL runs one container per app with no documented private network between apps, so the compose pair (web + api) cannot be deployed there as-is.
- **A Worker in front.** Passkeys need a stable hostname of the owner's, and the free plan only gives `*.cranl.net`.

## What changed
- **`Dockerfile.cranl`**: one image with the web app (nginx, frontend, exercise media) and the api. It is the same layout as the single pod in `kubernetes/`.
  - **It sits at the repo root,** not under `deploy/cranl/`. CranL's builder (Dokploy) has no build-context setting and builds from the Dockerfile's own folder. The first real deploy, from `deploy/cranl/Dockerfile`, failed with every repo path "not found".
  - **Stages:** a frontend build stage identical to the web image's, an api production-install stage, and the `nginx-unprivileged` runtime with the `node` binary from `node:22-alpine`. A build-time `node --version` guards against a libc mismatch between the two images.
  - **api files** are copied by glob (`api/*.js`), so a new module can't be left out.
  - **No BuildKit-only syntax.**
  - **Users:** the api runs as root, as in the api image (unknown volume ownership, the Coach's privilege drop). The nginx master runs as root and its workers as `nginx`.
  - **Found on the first local run:** an nginx started entirely as uid 101 can't open its logs, which point at the root-owned container stdout/stderr.
- **`deploy/cranl/start.sh`**: a POSIX-sh supervisor under `tini`.
  - **Ports:** nginx listens on `NGINX_PORT`, else an injected `PORT`, else 8080. The api moves to an internal `API_PORT` (3001), so a platform default of 3000 can never route around nginx.
  - **Stopping:** a requested stop exits 0. If either process dies on its own, the container exits 1 so the platform restarts it whole.
- **`deploy/cloudflare-proxy/`**: a dependency-free Worker on a Custom Domain (`wrangler.jsonc`, `worker.js`). It forwards every request to the CranL origin, changing only the host. Body streaming, `redirect: manual` and the response are left untouched.
  - **No client-IP headers**, because the origin is directly reachable and they would be forgeable.
  - **No `workers.dev` or preview URLs.**
- **Tests:**
  - `api/test/cranl-dockerfile.test.js` (6) keeps the combined image in step with `web/Dockerfile`:
    - media and web-app copies;
    - the nginx set-up block;
    - the build stage;
    - the api glob;
    - no BuildKit syntax and no `ENV PORT`;
    - `start.sh` is valid busybox sh.

    A deleted media line makes it fail with the exact missing `COPY`.
  - `deploy/cloudflare-proxy/worker.test.js` (6) covers the host swap and pass-through of headers and body; the response returned by identity (so `Set-Cookie` and `Location` are untouched); and 500 and 502 errors.
- **CI and ignore files:** `test.yml` watches `deploy/**` and runs the Worker tests. `.gitignore` and `.dockerignore` ignore wrangler's state.
- **Docs:** `docs/SELF_HOSTING_CRANL.md`, linked from `docs/README.md`.

## Verification (local, Docker)
- **Build and boot:**
  - `docker build -f Dockerfile.cranl .` works (726 MB unpacked). The log reads `nginx on :8080, api on 127.0.0.1:3001`.
  - `/api/health` answers `{"ok":true,"writable":true}`, the page returns 200, and both media sets are served (open SVGs with the sandboxing CSP).
  - Processes: tini → supervisor → `node server.js` (root) + nginx master (root) + 4 workers (`nginx`).
- **Lifecycle:**
  - The `secret` is unchanged across a restart.
  - Killing node stops the container with exit 1 and a logged reason.
  - `docker stop` takes 1 s with exit 0.
  - An injected `PORT=3000` makes nginx listen on 3000 and the api on 3001, and both answer.
  - A malformed `BASE_PATH` still refuses to start.
- **Browser:** passkey sign-up through the container (`register/verify` 200). After a container restart, `/api/me` still returns the signed-in profile.
- **Suites:** the new tests pass 6/6 and 6/6.

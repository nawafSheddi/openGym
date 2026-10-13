/* Dockerfile.cranl builds the web app and the api into ONE image (for platforms with one
   container per app and no private network, docs/SELF_HOSTING_CRANL.md). It re-states parts of
   web/Dockerfile and api/Dockerfile, so a change made to those alone would silently leave the
   combined image behind — a missing media folder, an nginx that can't start unprivileged, a new
   api module that isn't copied. These checks keep the three in step, and keep the supervisor
   script to what busybox ash can run. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const combined = read('Dockerfile.cranl');
const web = read('web/Dockerfile');
const START = path.join(ROOT, 'deploy/cranl/start.sh');

// Instruction lines only (comments dropped), trimmed and without a trailing line-continuation
// backslash, so indentation and a line's place inside a multi-line RUN never matter.
const lines = src => src.split('\n').map(l => l.trim().replace(/\s*\\$/, '')).filter(l => l && !l.startsWith('#'));
// The same, joined back into one string: for patterns that must not appear outside comments.
const code = src => lines(src).join('\n');

test('the api is copied by glob, with package.json for ESM and the whole coach/ tree', () => {
  // A glob cannot fall behind server.js's imports the way api/Dockerfile's hand-kept list can
  // (that list has its own guard, dockerfile-copy.test.js).
  assert.ok(lines(combined).includes('COPY api/package.json api/*.js ./'));
  assert.ok(lines(combined).includes('COPY api/coach ./coach'));
  assert.match(combined, /npm ci --omit=dev --omit=optional/, 'same production install as the default api image');
});

test('every media and web-app COPY in web/Dockerfile is in the combined image too', () => {
  const wanted = lines(web).filter(l => /^COPY (catalogue\/|web\/nginx\.conf\.template|--from=build \/app\/frontend\/dist)/.test(l));
  assert.ok(wanted.length >= 4, 'found the web image COPY lines to compare');
  for (const l of wanted) {
    // The combined file names its frontend stage web-build rather than build.
    const expected = l.replace('--from=build ', '--from=web-build ');
    assert.ok(lines(combined).includes(expected), `missing from Dockerfile.cranl: ${expected}`);
  }
  assert.ok(lines(combined).some(l => l.startsWith('COPY web/05-check-base-path.sh /docker-entrypoint.d/')),
    'the BASE_PATH guard runs here too');
});

test('the nginx set-up block is web/Dockerfile\'s, line for line', () => {
  // The sed/chown/chmod/grep lines of the RUN that moves nginx's pid and temp paths under /tmp.
  const setup = src => lines(src).filter(l => /^(&& )?(sed -i|chown -R|chmod -R g\+w|grep -Eq|! grep -Eq|if ! grep|fi)\b/.test(l));
  const fromWeb = setup(web);
  assert.ok(fromWeb.length >= 6, 'found the web image nginx block');
  const fromCombined = setup(combined);
  for (const l of fromWeb) assert.ok(fromCombined.includes(l), `nginx set-up line differs or is missing: ${l}`);
});

test('the frontend build stage matches the web image\'s', () => {
  assert.match(combined, /RUN npm ci --ignore-scripts/);
  assert.ok(lines(combined).includes('COPY api/coach/core/ /app/api/coach/core/'));
  assert.match(combined, /RUN APP_BUILD="\$APP_BUILD" npm run build/);
});

test('no BuildKit-only syntax, and PORT / NGINX_PORT are left to start.sh', () => {
  assert.doesNotMatch(code(combined), /--platform=|COPY --chmod/, 'the platform builder may not be BuildKit');
  // An ENV here would hide a platform-injected PORT from start.sh's port choice.
  assert.doesNotMatch(code(combined), /^ENV\s+(PORT|NGINX_PORT)\b/m);
  assert.match(combined, /^STOPSIGNAL SIGTERM$/m);
  assert.match(combined, /^ENTRYPOINT \["\/sbin\/tini", "--"\]$/m);
});

test('start.sh is valid POSIX sh that busybox ash can run', () => {
  const sh = spawnSync('sh', ['-n', START], { encoding: 'utf8' });
  assert.equal(sh.status, 0, sh.stderr);
  const src = code(fs.readFileSync(START, 'utf8'));
  assert.doesNotMatch(src, /wait -n/, 'busybox ash has no `wait -n`');
  assert.doesNotMatch(src, /\[\[|\bfunction\b|\$\{[A-Za-z_]+\/\//, 'bashisms');
  assert.ok(fs.statSync(START).mode & 0o111, 'executable');
});

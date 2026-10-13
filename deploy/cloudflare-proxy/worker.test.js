// The custom-domain proxy (worker.js): only the host may change on the way to the origin, and the
// origin's answer must come back untouched. Node 22's global Request/Headers/Response stand in for
// the Workers runtime.  Run: node --test deploy/cloudflare-proxy/worker.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker, { upstream } from './worker.js'

const env = { ORIGIN_HOST: 'openbody.cranl.net' }

test('swaps only the host: scheme https, path, query and method kept', () => {
  const req = new Request('https://body.nawaf.solutions/api/data/rev?x=1&y=two', { method: 'GET' })
  const { url, init } = upstream(req, env)
  assert.equal(url, 'https://openbody.cranl.net/api/data/rev?x=1&y=two')
  assert.equal(init.method, 'GET')
  assert.equal(init.redirect, 'manual', 'redirects go back to the browser, not followed here')
})

test('passes every browser header through except Host', () => {
  const req = new Request('https://body.nawaf.solutions/api/data', {
    method: 'PUT',
    headers: {
      host: 'body.nawaf.solutions', cookie: '__Host-gymsid=abc', origin: 'https://body.nawaf.solutions',
      'sec-fetch-site': 'same-origin', range: 'bytes=0-99', 'content-type': 'application/json',
    },
    body: '{}',
    duplex: 'half',
  })
  const { init } = upstream(req, env)
  assert.equal(init.headers.get('host'), null)
  assert.equal(init.headers.get('cookie'), '__Host-gymsid=abc')
  assert.equal(init.headers.get('origin'), 'https://body.nawaf.solutions', 'the CSRF check sees the real origin')
  assert.equal(init.headers.get('sec-fetch-site'), 'same-origin')
  assert.equal(init.headers.get('range'), 'bytes=0-99')
})

test('streams the body for writes and sends none for GET/HEAD', () => {
  const put = new Request('https://body.nawaf.solutions/api/media/upload', { method: 'POST', body: 'data', duplex: 'half' })
  assert.equal(upstream(put, env).init.body, put.body, 'the same stream, not a buffered copy')
  for (const method of ['GET', 'HEAD']) {
    assert.equal(upstream(new Request('https://body.nawaf.solutions/', { method }), env).init.body, null)
  }
})

test('rejects a missing, malformed or self-pointing ORIGIN_HOST', () => {
  const req = new Request('https://body.nawaf.solutions/')
  assert.throws(() => upstream(req, {}), /bare hostname/)
  assert.throws(() => upstream(req, { ORIGIN_HOST: 'https://openbody.cranl.net' }), /bare hostname/)
  assert.throws(() => upstream(req, { ORIGIN_HOST: 'localhost' }), /bare hostname/)
  assert.throws(() => upstream(req, { ORIGIN_HOST: 'body.nawaf.solutions' }), /itself/)
  // case and stray spaces in the var are tolerated
  assert.equal(upstream(req, { ORIGIN_HOST: ' OpenBody.cranl.net ' }).url, 'https://openbody.cranl.net/')
})

test('returns the origin response itself, so Set-Cookie, Location and status are untouched', async t => {
  const original = new Response(null, { status: 302, headers: { location: '/', 'set-cookie': '__Host-gymsid=x; Path=/' } })
  const seen = []
  t.mock.method(globalThis, 'fetch', async (url, init) => { seen.push([url, init]); return original })
  const res = await worker.fetch(new Request('https://body.nawaf.solutions/old?q=1'), env)
  assert.equal(res, original)
  assert.equal(seen[0][0], 'https://openbody.cranl.net/old?q=1')
})

test('answers 502 when the origin is unreachable and 500 when misconfigured', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('network') })
  assert.equal((await worker.fetch(new Request('https://body.nawaf.solutions/'), env)).status, 502)
  const bad = await worker.fetch(new Request('https://body.nawaf.solutions/'), {})
  assert.equal(bad.status, 500)
  assert.match(await bad.text(), /ORIGIN_HOST/)
})

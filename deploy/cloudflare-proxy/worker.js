// openBody's front door on a custom domain: a Cloudflare Worker that forwards every request to the
// app's own address on the hosting platform (e.g. https://<app>.cranl.net) and hands the answer
// back untouched. It exists because the platform's free plan has no custom domains, while passkeys
// need one stable hostname of the owner's (RP_ID). See docs/SELF_HOSTING_CRANL.md.
//
// What makes a straight pass-through enough (checked against api/server.js):
//   - nothing in the api reads the Host header: RP_ID and ORIGIN come from env, and so do the
//     cookie's Secure/__Host- prefix and the push VAPID subject;
//   - cookies carry no Domain attribute, so the browser binds them to the Worker's hostname;
//   - the CSRF check reads the browser's own Sec-Fetch-Site / Origin headers, passed through as-is;
//   - nginx redirects are relative (absolute_redirect off), so a Location never names the origin.
//
// Deliberately NOT added: any client-IP header. The origin is also reachable directly, so a header
// the api would trust could be forged by anyone who skips the Worker; see the doc's "Client IP".

// A bare hostname: letters, digits and hyphens in two or more dot-separated labels.
const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

/**
 * The request to send upstream for one incoming request: same method, path, query, headers and
 * (streamed) body, with only the scheme and host swapped for the origin's. Pure, so it is unit-
 * tested without the Workers runtime (worker.test.js).
 *
 * @param {Request} request  the incoming request
 * @param {{ ORIGIN_HOST?: string }} env  the Worker's vars
 * @returns {{ url: string, init: RequestInit }}
 */
export function upstream(request, env) {
  const host = String(env?.ORIGIN_HOST || '').trim().toLowerCase()
  if (!HOSTNAME.test(host)) throw new Error('ORIGIN_HOST must be a bare hostname, e.g. myapp.cranl.net')

  const url = new URL(request.url)
  // A misconfiguration that points the Worker at its own hostname would recurse until it failed.
  if (url.hostname === host) throw new Error('ORIGIN_HOST points at this Worker itself')
  url.protocol = 'https:'
  url.hostname = host
  url.port = ''

  // Every browser header travels on (Cookie, Origin, Sec-Fetch-*, Range for the video clips …);
  // Host is dropped so fetch() sets it from the new URL, which the platform routes by.
  const headers = new Headers(request.headers)
  headers.delete('host')

  // GET and HEAD carry no body; anything else streams through without being buffered (uploads).
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  return {
    url: url.toString(),
    init: {
      method: request.method,
      headers,
      body: hasBody ? request.body : null,
      // Hand redirects to the browser instead of following them here, so it sees nginx's own.
      redirect: 'manual',
    },
  }
}

export default {
  /**
   * Forward one request. The origin's Response is returned as-is: status, Set-Cookie, Location,
   * caching headers and the streamed body all reach the browser unchanged.
   */
  async fetch(request, env) {
    let up
    try {
      up = upstream(request, env)
    } catch (e) {
      // A deploy-time mistake (missing or wrong ORIGIN_HOST); say so instead of a blank failure.
      return new Response('openBody proxy misconfigured: ' + e.message, { status: 500 })
    }
    try {
      return await fetch(up.url, up.init)
    } catch {
      // The origin is down or unreachable (e.g. the container is restarting).
      return new Response('openBody is not reachable right now. Try again in a moment.', { status: 502 })
    }
  },
}

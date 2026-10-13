# Hosting openBody on CranL, on your own Cloudflare domain

This guide runs openBody on [CranL](https://cranl.com), a container PaaS, with no server of your own. It puts the app at a hostname on a domain you manage in Cloudflare. It works on CranL's free plan.

```
browser ──https──▶ Cloudflare Worker ──https──▶ <app>.cranl.net ──▶ nginx :8080 ──▶ api 127.0.0.1:3001 ──▶ /data (volume)
                   body.example.com             (CranL edge)        └────────── one container ──────────┘
                   (deploy/cloudflare-proxy)                          (deploy/cranl/Dockerfile)
```

## Why it is shaped like this

- **One container.** openBody must be served from a single origin:
  - the web app calls a relative `/api`;
  - the session cookie is host-only;
  - the CSRF check wants `Sec-Fetch-Site: same-origin`;
  - passkeys are bound to `RP_ID`.

  nginx reaches the api over plain http. Docker Compose provides that with two containers on a private network. CranL runs one container per app and documents no private network between apps. So [`deploy/cranl/Dockerfile`](../deploy/cranl/Dockerfile) builds the web app and the api into one image, the same shape as the single pod in [`kubernetes/`](../kubernetes/).
- **Inside the image.** [`deploy/cranl/start.sh`](../deploy/cranl/start.sh) starts both processes under `tini`. If either one dies, it stops the container with exit 1 so CranL restarts it whole.
- **A Worker in front.** CranL's free plan has no custom domains, and passkeys need a stable hostname of your own. A tiny Cloudflare Worker on a *Custom Domain*, [`deploy/cloudflare-proxy`](../deploy/cloudflare-proxy/), forwards every request to the app's `*.cranl.net` address and returns the answer untouched. Deploying it creates the DNS record and certificate for you. On a paid CranL plan you could instead add the domain to the app directly and skip the Worker.

## 1. Create the app on CranL

Install the [CranL CLI](https://docs.cranl.com) and sign in with `cranl login`. Then create an app with these settings:

| Setting | Value |
|---|---|
| Source | your fork's Git URL (public) or a connected GitHub repo, branch `main` |
| Build | `dockerfile`, with Dockerfile path `deploy/cranl/Dockerfile` and build path `/` (the repo root is the build context) |
| Port | `8080` |
| Region | any your plan allows (free: `netherlands-1`) |
| Volume | a persistent directory at **`/data`** |

**The volume is not optional.** `/data` holds the cookie-signing secret, every account and passkey (`db.json`), every profile's training data (`state-*.json`), the push keys (`vapid.json`), uploads and the audit log. Without a volume, each redeploy starts empty:
- everyone is signed out and their passkeys point at nothing;
- with `FIRST_USER_ADMIN=1`, the next visitor becomes admin.

Environment variables (replace the hostname with yours):

```
RP_ID=body.example.com
ORIGIN=https://body.example.com
FIRST_USER_ADMIN=1
```

Deploy, then check `https://<app>.cranl.net/api/health`. It should answer `{"ok":true,…}`.

**Leave `PORT` alone.** If CranL injects one, nginx listens on it and the api moves to an internal port (`API_PORT`, default 3001). Set `NGINX_PORT` only if you need nginx on a different port than the platform's.

## 2. Put it on your domain with the Worker

In `deploy/cloudflare-proxy/wrangler.jsonc`:
- set `routes[0].pattern` to your hostname;
- set `vars.ORIGIN_HOST` to the app's bare cranl hostname, e.g. `myapp.cranl.net` (no `https://`).

Then:

```bash
cd deploy/cloudflare-proxy
npx wrangler@4.143.0 login
npx wrangler@4.143.0 deploy
```

Creating the custom domain fails if a CNAME record already exists for that hostname. Delete it first.

Open `https://body.example.com` and create your profile. Passkeys only work on this hostname, not on the `cranl.net` address.

## 3. Close sign-up

You created the first profile, and `FIRST_USER_ADMIN=1` made it the admin. Now set `INVITE_ONLY=1` on the app and restart it. New profiles then need an invite code from the **Admin dashboard** (**Settings → Account → Admin dashboard**). Guest mode never touches the server, so it stays available unless you also set `ALLOW_GUEST=0`.

If you're still signed in after the restart, the volume is working: the secret and accounts survived.

## Things to know

- **One instance only.** WebAuthn challenges and rate-limit counters live in memory, and the JSON files have a single writer. Never scale the app above one instance.
- **`cranl.net` is a second way in.** The app also answers on its `cranl.net` address. Passkeys and their sessions don't work there, because `RP_ID` and the host-only cookie belong to your domain. But the static app and the api respond. This is harmless for a passkey-only instance; keep it in mind if you enable `PASSWORD_LOGIN`.
- **Client IP.** The Worker adds no client-IP header, and `TRUST_PROXY` and `CF_CONNECTING_IP` stay unset.
  - Why: the origin is reachable directly, so any trusted header could be forged by skipping the Worker. Inside the container, the api would also take the header from anything that reaches its port.
  - The cost: the audit log shows CranL's edge address, and the password-login throttle (only used with `PASSWORD_LOGIN`) counts the whole instance as one address. This is the same trade-off described in [the Kubernetes guide](SELF_HOSTING_KUBERNETES.md).
- **Limits on the Cloudflare side.**
  - The Workers free plan allows 100,000 requests a day and 100 MB request bodies, which covers the 48 MB media uploads.
  - Cloudflare also caps how long it waits for the origin (about 100 seconds). That matters only for a very slow AI-coach call.
- **Backups.** Everything is in the `/data` volume. Export it regularly. Also keep using **Settings → Data & backup** in the app, which writes a full backup file of your own training data.
- **Updates.** Push to the branch CranL builds from and redeploy. The volume carries the data across.

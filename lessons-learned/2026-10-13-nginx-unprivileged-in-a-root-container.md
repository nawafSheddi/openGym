# nginx-unprivileged started as uid 101 inside a root container cannot open its logs

**Date:** 2026-10-13 (building the one-container CranL image, `Dockerfile.cranl`)

## What happened
- **The setup.** The combined image runs as root, because the api needs to write the `/data` volume and the Coach drops privileges. The first `start.sh` launched nginx as uid 101 through `su-exec`, to keep the web image's "nginx never root" property.
- **The failure.** nginx died at once with `open() "/var/log/nginx/error.log" failed (13: Permission denied)`. The supervisor then correctly stopped the whole container.

## Root cause
- **Where the logs point.** In the nginx images, `/var/log/nginx/*.log` are symlinks to `/dev/stdout` and `/dev/stderr`. Opening them re-opens the container's stdio pipes through `/proc/self/fd`.
- **Why it works in the web image.** That container starts as uid 101, so the pipes belong to uid 101.
- **Why it failed here.** The pipes are created for the root process, and an unprivileged child can't re-open them by path.

## Rule
- **Inside a root container, use nginx's classic model.** Run the master as root, so it opens the logs and binds the port, and put a `user nginx;` line in `nginx.conf` so the request-handling workers drop to uid 101. Don't `su-exec` the whole nginx process.
- **Test a supervisor image by booting it**, not just by building it. The failure only shows at start-up. The supervisor's exit-1-on-child-death is what made it obvious instead of a half-working container.

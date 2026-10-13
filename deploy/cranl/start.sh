#!/bin/sh
# Supervisor for the single-container openBody image (Dockerfile.cranl): starts the api and
# nginx, forwards a stop to both, and exits non-zero the moment either one dies on its own, so the
# platform restarts the whole container instead of leaving half an app running (nginx answering
# pages while every /api call fails). PID 1 is tini, which reaps orphans and forwards signals here.
#
# POSIX sh on busybox ash: no `wait -n`, so the loop polls both PIDs with `kill -0` once a second.
# `sleep 1 & wait $!` (instead of a bare `sleep 1`) keeps the traps responsive: a trapped signal
# interrupts `wait` at once, whereas it would only run after a foreground sleep finished.

set -u   # no `set -e`: `wait` returns the children's exit codes, which are expected to be non-zero

# --- Ports ----------------------------------------------------------------------------------------
# nginx listens where the platform sends traffic: NGINX_PORT if the owner set it, else a PORT the
# platform injected, else 8080. The api always moves to an internal API_PORT (3001), so a platform
# that routes to 3000 by default can never reach the api directly and bypass nginx (every page
# would 404). Both children then see PORT=<api port>: the api listens on it, and nginx's template
# uses PORT as the api's port.
API_PORT="${API_PORT:-3001}"
LISTEN="${NGINX_PORT:-${PORT:-8080}}"

case "$LISTEN" in ''|*[!0-9]*) echo "openbody: the nginx port '$LISTEN' is not a number" >&2; exit 1 ;; esac
case "$API_PORT" in ''|*[!0-9]*) echo "openbody: API_PORT '$API_PORT' is not a number" >&2; exit 1 ;; esac
if [ "$LISTEN" = "$API_PORT" ]; then
  echo "openbody: nginx and the api would both listen on $LISTEN; set API_PORT to another port" >&2
  exit 1
fi

# The image's HEALTHCHECK reads the chosen port from here.
echo "$LISTEN" > /tmp/openbody-listen-port

export NGINX_PORT="$LISTEN" PORT="$API_PORT" BACKEND=127.0.0.1
echo "openbody: nginx on :$LISTEN, api on 127.0.0.1:$API_PORT, data in ${DATA_DIR:-/data}"

# --- Start both ---------------------------------------------------------------------------------
# The api as root (it owns /data and drops privileges itself for Coach jobs). `exec` inside the
# subshell makes $! the node process itself.
(cd /app && exec node server.js) &
api=$!

# nginx through the base image's entrypoint, so the template is rendered and /docker-entrypoint.d/
# (05-check-base-path.sh) runs exactly as in the web image. Its master stays root (to open the
# logs, which point at this container's stdout/stderr); its workers run as `nginx` (the Dockerfile
# adds `user nginx;`).
/docker-entrypoint.sh nginx -g 'daemon off;' &
web=$!

# --- Stop ---------------------------------------------------------------------------------------
# TERM to node (it writes atomically, so a stop mid-write leaves at most a .tmp file behind) and
# QUIT to nginx (graceful: finish in-flight requests). QUIT is trapped too because the nginx base
# image's default stop signal is SIGQUIT.
stopping=
stop() {
  stopping=1
  kill -TERM "$api" 2>/dev/null
  kill -QUIT "$web" 2>/dev/null
}
trap stop TERM INT QUIT HUP

# --- Supervise ----------------------------------------------------------------------------------
# `wait` reaps whichever child has exited, so a dead process does not linger as a zombie that
# `kill -0` would still report as alive.
while kill -0 "$api" 2>/dev/null && kill -0 "$web" 2>/dev/null; do
  sleep 1 &
  wait $!
done

if [ -z "$stopping" ]; then
  echo "openbody: a process exited unexpectedly; stopping the container so it is restarted" >&2
fi
kill -TERM "$api" 2>/dev/null
kill -QUIT "$web" 2>/dev/null
wait "$api" 2>/dev/null
wait "$web" 2>/dev/null

# A requested stop is a clean exit; anything else must look like a failure to the platform.
[ -n "$stopping" ] && exit 0
exit 1

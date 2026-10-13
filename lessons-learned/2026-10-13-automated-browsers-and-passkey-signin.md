# Automated browsers can create a passkey but not sign in with one

**Date:** 2026-10-13 (passkey and two-device sync end-to-end run in Docker)

## What happened
1. **Sign-up worked, sign-in did not.** In the Claude desktop Browser pane, "Create passkey profile" completed (the owner approved the macOS prompt): `register/options` → `register/verify` 200.
2. **Every passkey sign-in failed silently.** "Confirm with a passkey" (for Add another device) and "Sign in with passkey" sent `login/options`, then nothing. The UI showed no error.
   - Wrapping `navigator.credentials.get` showed a `NotAllowedError` about 2 s after the call, even though the owner approved the prompt.
   - The same thing happened in the Chrome DevTools MCP Chrome (an isolated context). Its `evaluate_script` also runs outside the page's JS world, so a wrapper installed there never sees the app's calls.
3. **Not an app bug.** The branch changed only wording in the auth client and server (`RP_NAME`, error text). Sign-in is upstream code, covered by `api/test/server-passkeys.test.js` with a simulated authenticator.

## Root cause
- The test browsers can't complete a WebAuthn assertion (`credentials.get`), although they can complete a creation. The Browser pane reports this itself.
- The app treats `NotAllowedError` as "the user cancelled" (`dismissed(e)` in `components/PasswordAuth.jsx`), so the failure is invisible in the UI.

## Rules
- **Don't retry a passkey sign-in in an automated browser.** One failure with `login/options` and no `login/verify` means the browser can't do it.
- **For a second signed-in device, use the pairing flow:** Settings → "Pair the mobile app" (`POST /api/pair/create`, which needs only a session), then redeem the code from a script (`POST /api/pair/redeem` → Bearer token). That's a real second client with its own session, with no WebAuthn involved.
- **To force a sync conflict,** push from the scripted device, then change something on the browser device before it polls `/api/data/rev`. Expect `PUT /api/data` 409, then 200 after the merge.
- **To see what WebAuthn returned,** wrap `navigator.credentials.get` in the page's own world (the Browser pane's `javascript_tool`), not through a tool that evaluates in an isolated world.

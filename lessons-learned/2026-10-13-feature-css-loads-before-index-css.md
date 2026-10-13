# Feature stylesheets load before index.css, so lone feature classes lose

**Date:** 2026-10-13 (checking phone and desktop × light and dark on the Docker build)

## What happened
- **Grey band chips.** Every flexibility band chip (Poor … Elite) rendered the same grey in the production build. Row-icon tints and two compact chips were also lost.
- **Missed by earlier checks.** The phase checks passed because grey-on-grey chips look plausible in a screenshot. Nobody compared them with what the CSS asked for.

## Root cause
- **Import order.** `main.jsx` imports `App.jsx`, which pulls in every `features/*/*.css`, before `./index.css`. In the bundle, `index.css` therefore comes after the feature rules, in dev and in prod alike.
- **The tie.** `.as-poor` on an element that also has `.tag` ties with `.tag` at (0,1,0), and the later `.tag` wins.
- **Why upstream never hit it.** Upstream keeps nearly all of its styling in `index.css`. The per-feature stylesheets are new in openBody.

## Rules
- **Name the base class.** A feature rule that styles an element also carrying an `index.css` class (`lrow-i`, `tag`, `chip`, `small`, …) must name that class too: `.tag.as-poor`, `.lrow-i.as-ico`. That matches `index.css`'s own `.tag.acc`.
- **The guard.** `src/features/feature-css-order.test.js` catches the literal pairings. A runtime-built class (`'as-' + label`) is only covered when its literal half carries the pairing, so keep such families qualified by hand.
- **Measure, don't eyeball.** When checking a UI, compare computed styles with intent. Copy the feature rules to the end of the page as a fresh `<style>` and diff `getComputedStyle`; anything that changes was being overridden.
- **Check contrast numerically.** A chip that "has a colour" can still fail WCAG AA.

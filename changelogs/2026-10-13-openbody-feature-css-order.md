# 2026-10-13: Feature styles lost to index.css (band chips grey) and phone/desktop × light/dark check

## The bug
On the flexibility Tests screen and the Stats card, **every band chip (Poor … Elite) was the same grey**. The tint on several row icons was also lost.
- `main.jsx` imports `App.jsx` first, which pulls in every `features/*/*.css`, and `./index.css` last. So the base rules come after the feature rules.
- A lone feature class on the same element as an `index.css` class ties on specificity and loses on order. For example, `.as-poor` on a `.tag`.
- Upstream never hit this because almost all of its styling is in `index.css`.

| Feature rule | Lost to | What was lost |
|---|---|---|
| `.as-band`, `.as-poor` … `.as-elite` | `.tag` | band colours, weight |
| `.as-ico`, `.fl-ico`, `.pg-ico`, `.wk-ico` | `.lrow-i` | icon tile tint and colour |
| `.sk-claim`, `.as-sign` | `.chip` | compact size and padding |
| `.as-steps` | `.small` | line height |

## Fix
- Each of these rules now also names the base class (`.tag.as-poor`, `.lrow-i.as-ico`, `.chip.sk-claim` …), following `index.css`'s own `.tag.acc` convention.
- `index.css` stays imported last. Moving it to the top would change the cascade for upstream's `coach.css`, `admin.css` and `FocusView.css`.
- **Guard:** `src/features/feature-css-order.test.js` reads each feature's JSX for `className` literals that pair a base class (`lrow-i`, `tag`, `chip`, `small`) with a feature class. It fails when the feature's CSS has a bare `.feature-class` rule that sets a property family the bare `.base` rule also sets.
  - On the old CSS it reports exactly the rules above.
  - With the fix it passes.

## Phone and desktop × light and dark check (Docker production build)
- **Screens:** Home (program card), Exercises (area filter), Workouts and its sheet, Skills and a ladder, Mobility and a flow preview, Tests and test sheets (including the ± sign chip), and Stats.
- **Sizes:** 375×812 and 1280×800, each in dark and light.
- **Method:** every screen was screenshotted. A runtime audit also copied every feature rule to the end of the page and diffed computed styles, so anything overridden in production shows up.
- **Result:** before the fix the audit found 8 rule groups overridden. After it, every screen at both sizes and both themes shows 0 overridden styles and no horizontal scroll.

## Found, not changed (design decisions for the owner)
- **Band chip contrast** (WCAG AA needs 4.5:1 for this small text):
  - Light: Poor 2.79, Fair 1.9, Great 3.1, Elite 4.01. Good passes at 19.0.
  - Dark: Poor 4.06. The rest pass.
- **Fair and Elite look the same in dark:** `--orange` #ff9f0a and `--skill` #f59e0b.
- **The mobility map doesn't match its legend.** The map shades tested areas in accent-teal strengths, but the legend chips are red / orange / yellow / teal / amber.
- **Stats "Mobility: 0 min this week"** shows beside a full-height bar when only seconds were logged. Bars are scaled to the week's maximum, and the label rounds to minutes.

## Verification
frontend 5202/5202 (5200 + 2 new) · runtime CSS audit clean on 8 screens × 2 sizes × 2 themes.

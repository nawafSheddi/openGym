// openBody's identity in one place.
//
// openBody is a divergent fork of openGym (github.com/DuarteSantos8/openGym) refocused on
// calisthenics and mobility. Anything that names the product, describes it, or points at "its"
// GitHub repository reads it from here, so a future rename is one edit instead of a hunt.
//
// Note on UI copy: user-visible sentences that contain the name still spell it literally inside
// translation calls, because frontend/scripts/check-source-strings.mjs extracts translatable strings
// statically and cannot follow an interpolated constant. Those are kept in sync by
// scripts/rebrand.mjs. Non-translated surfaces (titles, share cards, the update check) use BRAND.

export const BRAND = Object.freeze({
  // Product name, as written everywhere (capital B, no space).
  name: 'openBody',
  // One-line pitch: login screen subtitle source text and the PWA description.
  description: 'Calisthenics & mobility tracker',
  // GitHub "owner/repo" whose releases the in-app update check compares against. This is the
  // fork, not upstream: openGym's releases are a different product and must not be offered.
  repo: 'nawafSheddi/openGym',
  // Upstream project, credited in Settings → About and the README.
  upstream: 'DuarteSantos8/openGym'
})

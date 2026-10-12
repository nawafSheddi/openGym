import { t } from './i18n-core.js'
import { EXDB } from './exercises-data.js'

// Pieces of kit the catalogue never names as an exercise's equipment — "dumbbell bench press" is
// tagged `dumbbell`, yet it needs a bench; "chin-up" is tagged `body weight`, yet it needs a bar.
// They are read off the exercise name instead of stored on 1,300 rows, and sit in the profile
// checklist beside the real equipment values.
export const ACCESSORIES = ['bench', 'pull-up bar']

// Machines that carry their own seat, bar or bench: "lever incline chest press" needs no bench.
const SELF_CONTAINED = new Set(['leverage machine', 'sled machine', 'assisted'])

// Which accessories an exercise needs, e.g. ['bench'] for "dumbbell incline bench press".
export function accessoriesOf(ex) {
  if (!ex.n || SELF_CONTAINED.has(ex.eq)) return []
  const n = ex.n.toLowerCase()
  const need = []
  if (/\bbench\b|\bincline\b|\bdecline\b/.test(n)) need.push('bench')
  if (/pull-up|pull up|chin-up|\bchin\b|hanging|muscle-up|muscle up/.test(n)) need.push('pull-up bar')
  return need
}

// Every equipment value present in the catalogue, most common first, then the accessories —
// this becomes the checklist Settings shows when you build a profile.
export const ALL_EQUIPMENT = (() => {
  const c = {}
  EXDB.forEach(e => { if (e.eq) c[e.eq] = (c[e.eq] || 0) + 1 })
  const ranked = Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))
  // Clubbell and macebell have no catalogue entries yet (issue #393). They still belong on the
  // profile checklist and the custom-exercise chips, after everything the catalogue already uses.
  for (const extra of ['clubbell', 'macebell']) if (!ranked.includes(extra)) ranked.push(extra)
  return ranked.concat(ACCESSORIES)
})()

// Body weight is never gated by a profile — no gym or home setup can take it away from you,
// and every profile should be able to see bodyweight exercises regardless of what's checked.
// Only the accessory an exercise needs (a bar, a bench) can still gate it.
const ALWAYS_AVAILABLE = 'body weight'

export function activeProfile(S) {
  if (!S.equipFilterOn) return null
  const profiles = S.equipProfiles || []
  return profiles.find(p => p.id === S.activeEquipId) || null
}

// Whether an exercise is usable under the active profile. With filtering off, or no profile
// selected, everything is available — this is purely additive, never a trap that hides your
// whole library because you haven't set anything up yet.
export function exAvailable(S, ex) {
  const p = activeProfile(S)
  if (!p) return true
  return eqAvailable(profileEquipment(p), ex)
}

// A profile saved before the bench and the bar were on the checklist (#464) never had the chance
// to tick them; read as unticked, every bench press and pull-up would vanish from it overnight.
// It counts as having both until it is saved again, and the sheet shows them ticked.
export const ACC_V = 1
export function profileEquipment(p) {
  const have = p?.equipment || []
  return p && p.accV !== ACC_V ? [...new Set([...have, ...ACCESSORIES])] : have
}

// The same test against a bare equipment list, for callers that hold a profile rather than S.
export function eqAvailable(equipment, ex) {
  const have = equipment || []
  if (ex.eq && ex.eq !== ALWAYS_AVAILABLE) {
    // Equipment no profile can tick (an imported exercise's "custom") would hide the user's own
    // exercise under every profile, with no way to bring it back. It stays, like body weight.
    if (!ALL_EQUIPMENT.includes(ex.eq)) return true
    if (!have.includes(ex.eq)) return false
  }
  return accessoriesOf(ex).every(a => have.includes(a))
}

export function newProfile(name) {
  return { id: 'eq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, equipment: [], accV: ACC_V }
}

// ---------------------------------------------------------------- openBody: calisthenics kit --
// The built-in profile a new openBody user starts on (store/useStore.js freshState). It is an
// ordinary equipment profile — editable, deletable, switchable in Settings → Equipment — so it
// needs no special-casing anywhere the profile machinery already runs (library, picker, routine
// warnings, starter-plan fitting). "Show all equipment" in the library still reaches everything.
//
// What is in it, and why:
//   · body weight is always available anyway (ALWAYS_AVAILABLE) and is listed for clarity;
//   · pull-up bar and bench: the two accessories most bodyweight work needs (chin-ups, dips on a
//     bench, decline push-ups), read off exercise names by accessoriesOf;
//   · band / resistance band / suspension trainer: assistance and ring/TRX work;
//   · weighted: weighted pull-ups and dips with a belt or vest stay in (owner decision);
//   · wheel roller: the ab wheel; roller and stability ball: mobility and prehab props.
// Everything barbell, dumbbell, cable, kettlebell and machine is left out on purpose.
export const CALI_PROFILE_ID = 'cali'
export const CALI_EQUIPMENT = Object.freeze(['body weight', 'pull-up bar', 'bench', 'band', 'resistance band', 'suspension trainer', 'weighted', 'wheel roller', 'roller', 'stability ball'])

/** A fresh Calisthenics profile object. `equipment` is a new array every call, so editing one
 *  user's profile can never write through to the constant or to another state. */
export function caliProfile(name) {
  return { id: CALI_PROFILE_ID, name, equipment: [...CALI_EQUIPMENT], accV: ACC_V }
}

// openBody's mobility areas: which part of the body an exercise works or opens up.
//
// The taxonomy itself (11 areas, each mapped to body-map muscles) is content: catalogue/areas.json,
// compiled to lib/content/areas.js. This module answers "which areas does this exercise belong to"
// for the library's Area filter, the Workouts screen's "by area" groups and the mobility map.
//
// How an exercise gets its areas, and why:
//   · Main muscles only. muscleWeightsOf gives every muscle an exercise touches with a weight; only
//     the primary ones (weight >= PRIMARY) count. Otherwise a squat, whose helpers include the
//     adductors, would show up under "Groin & adductors" next to real groin stretches.
//   · The neck is special: its only body-map muscle is the trapezius, which every shrug and row
//     also trains. So "neck" comes from the body part or the name, never from the muscle.
//   · A few areas have no body-map muscle of their own that reliably fires (wrists, the thoracic
//     spine, ankles), so the exercise name tops up the muscle match for them.
// Pure: data in, data out, no store access.
import AREA_LIST from './content/areas.js'
import { muscleWeightsOf } from './muscles.js'

// Weight from which a muscle counts as an exercise's main muscle (target = 1, helpers ~0.4).
const PRIMARY = 0.75

export const AREAS = AREA_LIST
export const AREA_IDS = AREAS.map(a => a.id)
const BY_ID = Object.fromEntries(AREAS.map(a => [a.id, a]))
export const areaById = id => BY_ID[id] || null

// Name patterns that place an exercise in an area regardless of muscle data.
const NAME_RULES = {
  'neck': /\bneck\b|\bcervical\b/,
  'wrists-forearms': /\bwrists?\b|\bforearms?\b|\bfinger/,
  'thoracic': /\bthoracic\b|\bt-spine\b|\bthread the needle\b|\bopen book\b/,
  'calves-ankles': /\bankles?\b|\bcalf\b|\bcalves\b|\bdorsiflexion\b/,
  'hips': /\bhip opener\b|\b90\/90\b|\bpigeon\b|\bfrog pose\b/,
  'hamstrings': /\bhamstrings?\b|\bpike\b|\bforward fold\b/,
  'groin': /\bstraddle\b|\bpancake\b|\bside split\b|\bbutterfly\b|\badductors?\b/,
  'hip-flexors-quads': /\bcouch stretch\b|\bhip flexors?\b|\blunge stretch\b|\bquads? stretch\b/
}

// Library filtering runs areasOf over thousands of rows per render; cache per row object. Rows are
// stable (EXDB) and an edited custom exercise is a new object, so an entry can never go stale.
const CACHE = new WeakMap()

/** The area ids an exercise belongs to, in taxonomy order. [] for nothing recognisable. */
export function areasOf(ex) {
  if (!ex || typeof ex !== 'object') return []
  const hit = CACHE.get(ex)
  if (hit) return hit
  const out = computeAreas(ex)
  CACHE.set(ex, out)
  return out
}

function computeAreas(ex) {
  let weights = {}
  try { weights = muscleWeightsOf(ex) || {} } catch { weights = {} }
  const primary = new Set(Object.entries(weights).filter(([, w]) => w >= PRIMARY).map(([m]) => m))
  const name = String(ex.n || '').toLowerCase()
  const out = []
  for (const a of AREAS) {
    if (a.id === 'neck') {
      // never from the trapezius (see the header); body part or name only
      if (ex.bp === 'neck' || NAME_RULES.neck.test(name)) out.push('neck')
      continue
    }
    // A neck exercise belongs to the neck only, even when its muscle data says shoulders.
    if (ex.bp === 'neck') continue
    let byMuscle = a.muscles.some(m => primary.has(m) && !(m === 'trapezius' && a.id !== 'thoracic'))
    // Chest, biceps and triceps stretches open the front of the shoulder girdle: in mobility terms
    // they are shoulder work (the area list has no chest or arm area on purpose).
    if (a.id === 'shoulders' && !byMuscle && MOBILITY_CATS.has(ex.cat) && ['chest', 'biceps', 'triceps'].some(m => primary.has(m))) byMuscle = true
    const byName = NAME_RULES[a.id]?.test(name)
    if (byMuscle || byName) out.push(a.id)
  }
  return out
}

/** Whether an exercise belongs to one area. */
export const inArea = (ex, areaId) => areasOf(ex).includes(areaId)

// Catalogue categories that are about range of motion rather than strength.
const MOBILITY_CATS = new Set(['mobility', 'stretching', 'yoga', 'rehab'])
/** Whether an exercise is mobility work (the mobility lens and "Mobility" groups). */
export const isMobilityEx = ex => MOBILITY_CATS.has(ex?.cat)

/**
 * The area ids worth offering as filter chips for a list: only areas that at least one exercise
 * in the list belongs to (a chip that empties the list is a dead end), in taxonomy order.
 */
export function areaFilterOptions(list) {
  const present = new Set()
  for (const ex of list) for (const a of areasOf(ex)) present.add(a)
  return AREA_IDS.filter(id => present.has(id))
}

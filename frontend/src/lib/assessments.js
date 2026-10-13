// openBody flexibility assessments: standard range-of-motion tests (toe touch, splits, pancake,
// shoulder flexion, knee-to-wall…), each with benchmark bands from poor to elite.
//
// Content: catalogue/assessments/*.json → lib/content/assessments.js. Results are user data:
// `S.assessments: [{ id, testId, d, value, side? }]` (absent = none), stored in the test's own
// unit (cm, deg or s); an imperial profile only SEES inches (toDisplay/fromDisplay).
//
// Bands: ascending `below` thresholds over the value, the last one open-ended. A value equal to a
// threshold belongs to the band above it. The label decides the rank (poor 0 … elite 4), so a
// lower-is-better test (split height off the floor) ranks the same way as a higher-is-better one.
// A sided test ranks by its weaker side: mobility is limited by the tighter hip, not the average.
// Pure functions over plain data.
import TEST_LIST from './content/assessments.js'
import { AREAS } from './areas.js'

export const ASSESSMENTS = TEST_LIST
const BY_ID = Object.fromEntries(ASSESSMENTS.map(a => [a.id, a]))
export const assessmentById = id => BY_ID[id] || null
export const BAND_ORDER = ['poor', 'fair', 'good', 'great', 'elite']

/** The band a value falls in: `{ label, rank }` (rank 0 = poor … 4 = elite). */
export function bandOf(test, value) {
  const b = test.bands.find(x => x.below == null || value < x.below) || test.bands[test.bands.length - 1]
  return { label: b.label, rank: BAND_ORDER.indexOf(b.label) }
}

/** Whether a value is a plausible result for this test (a number inside its range). */
export const inRange = (test, v) => typeof v === 'number' && Number.isFinite(v) && v >= test.range[0] && v <= test.range[1]

const byDate = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)

/** One test's results, oldest first; `side` narrows a sided test to one side. */
export function resultsFor(S, testId, side = null) {
  return (S?.assessments || []).filter(r => r && r.testId === testId && (!side || r.side === side)).sort(byDate)
}

/** The newest result: `{ value, d }`, or `{ L, R }` for a sided test; null when never tested. */
export function latest(S, test) {
  const last = list => (list.length ? { value: list[list.length - 1].value, d: list[list.length - 1].d } : null)
  if (test.sided) {
    const L = last(resultsFor(S, test.id, 'L')), R = last(resultsFor(S, test.id, 'R'))
    return L || R ? { L, R } : null
  }
  return last(resultsFor(S, test.id))
}

/** Chart points for LineChart: `[{ t, y, d }]`. */
export function trend(S, testId, side = null) {
  return resultsFor(S, testId, side).map(r => ({ t: new Date(r.d + 'T12:00:00').getTime(), y: r.value, d: r.d }))
}

/** The test's current rank (0–4) from its latest result, the weaker side for a sided test; null untested. */
export function testRank(S, test) {
  const l = latest(S, test)
  if (!l) return null
  if (!test.sided) return bandOf(test, l.value).rank
  const ranks = [l.L, l.R].filter(Boolean).map(x => bandOf(test, x.value).rank)
  return Math.min(...ranks)
}

/** Whether `b` is better than `a` for this test's direction. */
export const improved = (test, a, b) => (test.better === 'lower' ? b < a : b > a)

/** Average rank per area over the tested tests that cover it: `{ areaId: rank }`. */
export function areaRanks(S, tests = ASSESSMENTS) {
  const sum = {}, n = {}
  for (const test of tests) {
    const r = testRank(S, test)
    if (r == null) continue
    for (const a of test.areas) { sum[a] = (sum[a] || 0) + r; n[a] = (n[a] || 0) + 1 }
  }
  return Object.fromEntries(Object.keys(sum).map(a => [a, sum[a] / n[a]]))
}

/**
 * Body-map load for the mobility map (components/BodyMap.jsx with MOBILITY_THRESHOLDS): each
 * tested area's muscles get rank + 1 (1 = poor … 5 = elite); a muscle in several areas takes the
 * best. Untested muscles are left out, so they draw unshaded.
 */
export function mobilityLoad(S, tests = ASSESSMENTS) {
  const out = {}
  for (const [areaId, rank] of Object.entries(areaRanks(S, tests))) {
    const area = AREAS.find(a => a.id === areaId)
    for (const m of area?.muscles || []) out[m] = Math.max(out[m] || 0, rank + 1)
  }
  return out
}
// One body-map level per band: poor → l1 … elite → l5 (0 = untested). Each level is painted in
// its band's colour (features/assessments/assessments.css), the same one the legend chips use.
export const MOBILITY_THRESHOLDS = [1, 2, 3, 4, 5].map(n => ({ at: n, level: n }))

/** The date of the most recent test result, or null. */
export function lastTestDate(S) {
  const ds = (S?.assessments || []).map(r => r.d).filter(Boolean).sort()
  return ds.length ? ds[ds.length - 1] : null
}

/** Whether a test day is due: never tested, or the last result is `intervalDays` or more old. */
export function isDue(S, now = Date.now(), intervalDays = 28) {
  const last = lastTestDate(S)
  if (!last) return true
  return now - new Date(last + 'T12:00:00').getTime() >= intervalDays * 86400000
}

// --- units: results are stored in the test's unit; imperial profiles see inches for cm ---
const CM_PER_IN = 2.54
/** The unit to show for a test: 'in' instead of 'cm' on an imperial (lb) profile. */
export const displayUnit = (test, unit) => (test.unit === 'cm' && unit === 'lb' ? 'in' : test.unit)
/** A stored value as shown (inches rounded to 0.1). */
export const toDisplay = (test, v, unit) => (displayUnit(test, unit) === 'in' ? Math.round(v / CM_PER_IN * 10) / 10 : v)
/** A typed value back to the stored unit. */
export const fromDisplay = (test, v, unit) => (displayUnit(test, unit) === 'in' ? v * CM_PER_IN : v)

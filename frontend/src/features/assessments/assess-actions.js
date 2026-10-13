// Store actions for flexibility test results: `S.assessments` (absent = none). Every result is a
// row `{ id, testId, d, value, side? }` in the test's own unit (lib/assessments.js).
import { useStore } from '../../store/useStore.js'
import { uid, todayISO } from '../../lib/format.js'
import { inRange } from '../../lib/assessments.js'

/**
 * Save results for one test day. `entries` is `[{ test, value, side? }]`; anything out of the
 * test's range (a typo) is dropped rather than poisoning the chart. Returns how many were saved.
 */
export function saveResults(entries, d = todayISO()) {
  const rows = entries
    .filter(e => e && e.test && inRange(e.test, e.value))
    .map(e => ({ id: uid(), testId: e.test.id, d, value: e.value, ...(e.side ? { side: e.side } : {}), _ts: Date.now() }))
  if (rows.length) useStore.getState().update(s => { s.assessments = [...(s.assessments || []), ...rows] })
  return rows.length
}

/** Remove one result by id. */
export function removeResult(id) {
  useStore.getState().update(s => { s.assessments = (s.assessments || []).filter(r => r.id !== id) })
}

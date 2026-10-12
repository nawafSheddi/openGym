// @vitest-environment happy-dom
// Flexibility test results in the store: saved per side, out-of-range typos dropped, removable,
// and an openGym state without the key still works.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api.js', () => ({ api: vi.fn() }))

import { useStore, DEF } from '../../store/useStore.js'
import { saveResults, removeResult } from './assess-actions.js'
import { assessmentById, latest } from '../../lib/assessments.js'

const reset = (extra = {}) => useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), ...extra } })
afterEach(() => reset())

describe('assessment results', () => {
  const toe = assessmentById('toe-touch')
  const split = assessmentById('front-split')

  it('saves one row per value, with the side for sided tests, on a state that had no results key', () => {
    reset()
    expect(useStore.getState().S.assessments).toBeUndefined()
    const n = saveResults([{ test: toe, value: -4 }, { test: split, value: 20, side: 'L' }, { test: split, value: 14, side: 'R' }], '2026-10-13')
    expect(n).toBe(3)
    const rows = useStore.getState().S.assessments
    expect(rows.map(r => [r.testId, r.value, r.side ?? null, r.d])).toEqual([
      ['toe-touch', -4, null, '2026-10-13'], ['front-split', 20, 'L', '2026-10-13'], ['front-split', 14, 'R', '2026-10-13']])
    expect(latest(useStore.getState().S, split)).toMatchObject({ L: { value: 20 }, R: { value: 14 } })
  })

  it('drops values outside a test’s range (a typo never reaches the chart)', () => {
    reset()
    expect(saveResults([{ test: toe, value: 4000 }, { test: toe, value: NaN }])).toBe(0)
    expect(useStore.getState().S.assessments).toBeUndefined()
  })

  it('removes one result', () => {
    reset()
    saveResults([{ test: toe, value: 1 }, { test: toe, value: 2 }])
    const [first] = useStore.getState().S.assessments
    removeResult(first.id)
    expect(useStore.getState().S.assessments.map(r => r.value)).toEqual([2])
  })
})

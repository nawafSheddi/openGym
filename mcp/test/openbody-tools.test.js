// openBody's MCP tools: skill-ladder progress and flexibility tests, read from the same synced
// state the app writes, with the app's own pure helpers (lib/ladder.js, lib/assessments.js).
import { describe, beforeEach, test, expect } from 'vitest'
import { _seedStateForTests } from '../src/state.js'
import { TOOLS } from '../src/tools.js'
import { skillById } from '../../frontend/src/lib/ladder.js'

const call = (name, params = {}) => TOOLS.find(t => t.name === name).handler(params)

let S
beforeEach(() => {
  S = { unit: 'kg', routines: [], week: {}, workouts: [], bodyweight: [], assessments: [] }
  _seedStateForTests(S)
})

describe('list_skills_progress', () => {
  test('lists all 12 ladders, everyone starting on step 1', () => {
    const r = call('list_skills_progress')
    expect(r.skills).toHaveLength(12)
    const fl = r.skills.find(s => s.id === 'front-lever')
    expect(fl).toMatchObject({ step: 1, mastered: false, manual_floor: false })
    expect(fl.current.practice).toMatch(/^\d+ x /)
  })

  test('a step cleared in enough sessions moves the athlete up', () => {
    const fl = skillById('front-lever')
    const st = fl.steps[0]
    const sets = Array.from({ length: st.unlock.sets }, () => (st.mode === 'time' ? { sec: st.unlock.sec, done: true } : { r: st.unlock.reps, done: true }))
    S.workouts = Array.from({ length: st.unlock.sessions }, (_, k) => ({ id: 'w' + k, d: '2026-10-0' + (k + 1), entries: [{ id: st.exId, sets }] }))
    const r = call('list_skills_progress', { skill: 'front-lever' })
    expect(r.skills).toHaveLength(1)
    expect(r.skills[0].step).toBe(2)
  })

  test('an unknown skill id is an error that lists the valid ones', () => {
    const r = call('list_skills_progress', { skill: 'nope' })
    expect(r.error).toMatch(/unknown skill/)
    expect(r.skills).toContain('planche')
  })
})

describe('list_assessments', () => {
  test('reports latest results with bands, the weaker side for a sided test, and area bands', () => {
    S.assessments = [
      { id: 'a', testId: 'toe-touch', d: '2026-10-01', value: -20 },
      { id: 'b', testId: 'toe-touch', d: '2026-10-10', value: 5 },
      { id: 'c', testId: 'knee-to-wall', d: '2026-10-10', value: 14, side: 'L' },
      { id: 'd', testId: 'knee-to-wall', d: '2026-10-10', value: 6, side: 'R' }
    ]
    const r = call('list_assessments')
    expect(r.tests).toHaveLength(11)
    const toe = r.tests.find(t => t.id === 'toe-touch')
    expect(toe.latest).toMatchObject({ value: 5, date: '2026-10-10' })
    expect(toe.history.map(h => h.value)).toEqual([-20, 5])
    const ktw = r.tests.find(t => t.id === 'knee-to-wall')
    expect(ktw.latest.left.value).toBe(14)
    expect(ktw.latest.right.value).toBe(6)
    expect(ktw.band).toBe(ktw.latest.right.band)        // the weaker (right) side decides
    expect(Object.keys(r.areas).length).toBeGreaterThan(0)
  })

  test('untested tests have no latest result and no band', () => {
    const r = call('list_assessments', { test: 'side-split' })
    expect(r.tests[0]).toMatchObject({ id: 'side-split', latest: null, band: null, history: [] })
  })

  test('no synced state answers with an error, like every tool', () => {
    _seedStateForTests(null)
    expect(call('list_assessments')).toHaveProperty('error')
    expect(call('list_skills_progress')).toHaveProperty('error')
  })
})

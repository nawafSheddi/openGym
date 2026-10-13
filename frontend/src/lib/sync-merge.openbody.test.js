// openBody's synced keys under the two-device merge (lib/sync-merge.js):
//   · S.assessments: union by id, like custom exercises; a deleted result stays deleted;
//   · S.skillOverrides: per-skill stamped entries ({ v, _ts }); the later choice wins per skill,
//     and a cleared floor ({ v: null }) beats an older value instead of coming back.
// Code review 2026-10-13: both were whole-key last-writer-wins, so a result logged on one device
// vanished when the other device synced anything newer.
import { describe, it, expect } from 'vitest'
import { mergeStates, stampDeletions } from './sync-merge.js'
import { overrideOf } from './ladder.js'

const base = { workouts: [], routines: [], bodyweight: [], customEx: [] }
const row = (id, testId, value) => ({ id, testId, d: '2026-10-10', value })

describe('assessments merge', () => {
  it('keeps results logged on both devices', () => {
    const phone = { ...base, _ts: 10, assessments: [row('a', 'toe-touch', 5)] }
    const laptop = { ...base, _ts: 20, assessments: [row('b', 'pancake-reach', 12)] }
    const out = mergeStates(phone, laptop)
    expect(out.assessments.map(r => r.id).sort()).toEqual(['a', 'b'])
  })

  it('a result deleted on one device stays deleted after the merge', () => {
    const before = { ...base, _ts: 10, assessments: [row('a', 'toe-touch', 5), row('b', 'toe-touch', 6)] }
    const after = stampDeletions(before, { ...before, _ts: 30, assessments: [row('b', 'toe-touch', 6)] }, 30)
    const other = { ...before, _ts: 20 }                // the other device still has 'a'
    const out = mergeStates(after, other)
    expect(out.assessments.map(r => r.id)).toEqual(['b'])
  })
})

describe('skill overrides merge', () => {
  it('takes each skill’s later choice, not the newer copy’s whole map', () => {
    const phone = { ...base, _ts: 50, skillOverrides: { planche: { v: 2, _ts: 50 }, 'front-lever': { v: 1, _ts: 10 } } }
    const laptop = { ...base, _ts: 40, skillOverrides: { 'front-lever': { v: 3, _ts: 40 } } }
    const out = mergeStates(phone, laptop)
    expect(overrideOf(out, 'planche')).toBe(2)
    expect(overrideOf(out, 'front-lever')).toBe(3)    // set later on the laptop, though the phone copy is newer
  })

  it('a cleared floor beats an older value', () => {
    const a = { ...base, _ts: 60, skillOverrides: { planche: { v: null, _ts: 60 } } }
    const b = { ...base, _ts: 70, skillOverrides: { planche: { v: 2, _ts: 30 } } }
    expect(overrideOf(mergeStates(a, b), 'planche')).toBe(null)
  })

  it('reads the bare-number form written before stamping', () => {
    expect(overrideOf({ skillOverrides: { planche: 2 } }, 'planche')).toBe(2)
    expect(overrideOf({}, 'planche')).toBe(null)
  })
})

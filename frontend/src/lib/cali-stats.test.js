// openBody Stats (lib/cali-stats.js): weekly strength-hold time vs mobility time, the skill-ladder
// summary, and whether there is any loaded work worth a 1RM / structural-balance view.
import { describe, it, expect } from 'vitest'
import { weeklyTime, skillSummary, hasLoadedWork } from './cali-stats.js'

// '0463' front plank (isometric, strength hold); a mobility-category exercise is looked up via isMob.
const isMob = id => id === 'MOB'
const w = (d, entries, extra = {}) => ({ id: d + Math.random(), d, entries, ...extra })
const hold = sec => ({ sec, done: true })

describe('weeklyTime', () => {
  it('buckets holds and mobility by Monday-starting week, oldest first, newest = this week', () => {
    const S = { workouts: [
      w('2026-10-12', [{ id: 'PLANK', sets: [hold(30), hold(45), { sec: 60, done: false }] }]),   // Mon this week
      w('2026-10-13', [{ id: 'MOB', sets: [hold(60)] }]),                                          // mobility exercise
      w('2026-10-13', [{ id: 'ANY', sets: [hold(40), hold(40)] }], { flow: 'hip-opener' }),       // a flow: all mobility
      w('2026-10-05', [{ id: 'PLANK', sets: [hold(20)] }]),                                        // last week
      w('2026-10-13', [{ id: 'PULL', sets: [{ r: 8, w: 0, done: true }] }])                       // reps: no time
    ] }
    const weeks = weeklyTime(S, '2026-10-13', 3, isMob)
    expect(weeks.map(x => x.weekStart)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    expect(weeks.map(x => x.holdSec)).toEqual([0, 20, 75])
    expect(weeks.map(x => x.mobilitySec)).toEqual([0, 0, 140])
  })
  it('handles an empty log', () => {
    expect(weeklyTime({}, '2026-10-13', 2, isMob)).toEqual([
      { weekStart: '2026-10-05', holdSec: 0, mobilitySec: 0 }, { weekStart: '2026-10-12', holdSec: 0, mobilitySec: 0 }])
  })
})

describe('skillSummary', () => {
  const skills = [
    { id: 'a', steps: [{ exId: 'A1', mode: 'reps', unlock: { sets: 1, reps: 5, sessions: 1 } }, { exId: 'A2', mode: 'reps', unlock: { sets: 1, reps: 5, sessions: 1 } }] },
    { id: 'b', steps: [{ exId: 'B1', mode: 'reps', unlock: { sets: 1, reps: 5, sessions: 1 } }] }
  ]
  it('counts unlocked steps and mastered skills', () => {
    const S = { workouts: [w('2026-10-01', [{ id: 'A1', sets: [{ r: 5, done: true }] }, { id: 'B1', sets: [{ r: 6, done: true }] }])] }
    expect(skillSummary(S, skills)).toEqual({ total: 2, mastered: 1, stepsUnlocked: 2, started: 2 })
    expect(skillSummary({ workouts: [] }, skills)).toEqual({ total: 2, mastered: 0, stepsUnlocked: 0, started: 0 })
  })
})

describe('hasLoadedWork', () => {
  it('is true only when a done set carried load', () => {
    expect(hasLoadedWork({ workouts: [w('x', [{ id: 'P', sets: [{ r: 8, w: 0, done: true }] }])] })).toBe(false)
    expect(hasLoadedWork({ workouts: [w('x', [{ id: 'P', sets: [{ r: 5, w: 10, done: false }] }])] })).toBe(false)
    expect(hasLoadedWork({ workouts: [w('x', [{ id: 'P', sets: [{ r: 5, w: 10, done: true }] }])] })).toBe(true)
    expect(hasLoadedWork({})).toBe(false)
  })
})

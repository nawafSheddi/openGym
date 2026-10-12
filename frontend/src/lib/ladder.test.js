// openBody skill ladders (lib/ladder.js): where you stand on each skill, derived from what you
// logged, and how a routine entry that follows a ladder moves up to the next variation.
import { describe, it, expect } from 'vitest'
import { SKILLS, skillById, sessionMeets, metSessions, currentStep, unlockProgress, ladderedEntry, applyLadders, entryDefaults, skillStatus } from './ladder.js'

// A small ladder: reps step → hold step → harder hold step.
const SKILL = {
  id: 'test-lever', name: 'Test lever', family: 'pull',
  steps: [
    { exId: 'A', label: 'Pulls', mode: 'reps', target: { sets: 3, reps: 8 }, unlock: { sets: 3, reps: 12, sessions: 2 } },
    { exId: 'B', label: 'Tuck', mode: 'time', target: { sets: 3, sec: 8 }, unlock: { sets: 3, sec: 15, sessions: 2 } },
    { exId: 'C', label: 'Full', mode: 'time', target: { sets: 3, sec: 3 }, unlock: { sets: 3, sec: 8, sessions: 3 } }
  ]
}
// A logged workout with one entry. `sets` are rows like the app logs them.
const wk = (d, id, sets) => ({ id: d + id, d, entries: [{ id, sets }] })
const reps = (...rs) => rs.map(r => ({ r, done: true }))
const holds = (...ss) => ss.map(sec => ({ sec, done: true }))

describe('catalogue skills', () => {
  it('ships the 12 ladders', () => {
    expect(SKILLS.map(s => s.id).sort()).toEqual(['back-lever', 'dragon-flag', 'front-lever', 'handstand', 'handstand-push-up', 'human-flag', 'l-sit', 'muscle-up', 'one-arm-pull-up', 'one-arm-push-up', 'pistol-squat', 'planche'])
    expect(skillById('front-lever').steps.length).toBeGreaterThan(3)
    expect(skillById('nope')).toBe(null)
  })
})

describe('sessionMeets', () => {
  const step = SKILL.steps[1]
  it('needs `unlock.sets` done rows at or above the bar', () => {
    expect(sessionMeets({ id: 'B', sets: holds(15, 16, 15) }, step)).toBe(true)
    expect(sessionMeets({ id: 'B', sets: holds(15, 14, 15) }, step)).toBe(false)
    expect(sessionMeets({ id: 'B', sets: holds(20, 20) }, step)).toBe(false)          // too few sets
  })
  it('ignores sets not checked off and warm-up rows', () => {
    expect(sessionMeets({ id: 'B', sets: [...holds(15, 15), { sec: 30, done: false }] }, step)).toBe(false)
    expect(sessionMeets({ id: 'B', sets: [...holds(15, 15), { sec: 30, done: true, phase: 'warmup' }] }, step)).toBe(false)
  })
  it('reads reps for a reps step', () => {
    expect(sessionMeets({ id: 'A', sets: reps(12, 12, 13) }, SKILL.steps[0])).toBe(true)
    expect(sessionMeets({ id: 'A', sets: reps(12, 11, 13) }, SKILL.steps[0])).toBe(false)
  })
})

describe('currentStep', () => {
  it('starts at the first step with nothing logged', () => {
    expect(currentStep({ workouts: [] }, SKILL)).toEqual({ index: 0, mastered: false })
    expect(currentStep({}, SKILL)).toEqual({ index: 0, mastered: false })
  })

  it('moves on once a step was met in enough separate sessions', () => {
    const one = { workouts: [wk('2026-10-01', 'A', reps(12, 12, 12))] }
    expect(currentStep(one, SKILL).index).toBe(0)
    const two = { workouts: [...one.workouts, wk('2026-10-03', 'A', reps(12, 12, 12))] }
    expect(currentStep(two, SKILL).index).toBe(1)
  })

  it('counts a session once even if the exercise appears twice in it', () => {
    const w = { id: 'w', d: '2026-10-01', entries: [{ id: 'A', sets: reps(12, 12, 12) }, { id: 'A', sets: reps(12, 12, 12) }] }
    expect(currentStep({ workouts: [w] }, SKILL).index).toBe(0)
  })

  it('jumps to the step after the highest one met, even if an easier step was skipped', () => {
    const S = { workouts: [wk('2026-10-01', 'B', holds(15, 15, 15)), wk('2026-10-03', 'B', holds(16, 15, 15))] }
    expect(currentStep(S, SKILL).index).toBe(2)
  })

  it('reports mastered (and stays on the last step) once the last step is met', () => {
    const S = { workouts: [1, 2, 3].map(n => wk('2026-10-0' + n, 'C', holds(8, 8, 9))) }
    expect(currentStep(S, SKILL)).toEqual({ index: 2, mastered: true })
  })

  it('honours a manual override as a floor, clamped to the ladder', () => {
    expect(currentStep({ workouts: [], skillOverrides: { 'test-lever': 1 } }, SKILL).index).toBe(1)
    expect(currentStep({ workouts: [], skillOverrides: { 'test-lever': 99 } }, SKILL).index).toBe(2)
    expect(currentStep({ workouts: [], skillOverrides: { 'test-lever': -4 } }, SKILL).index).toBe(0)
    expect(currentStep({ workouts: [], skillOverrides: { 'test-lever': 'x' } }, SKILL).index).toBe(0)
  })
})

describe('unlockProgress', () => {
  it('reports sessions met, sessions needed, and the best single set', () => {
    const S = { workouts: [wk('2026-10-01', 'B', holds(15, 15, 15)), wk('2026-10-02', 'B', holds(10, 22, 9))] }
    expect(unlockProgress(S, SKILL, 1)).toEqual({ sessionsMet: 1, sessionsNeeded: 2, best: 22, unit: 'sec' })
    expect(metSessions(S, SKILL.steps[1])).toBe(1)
  })
})

describe('ladderedEntry / applyLadders', () => {
  const skills = [SKILL]
  const entry = { id: 'A', sets: 3, reps: 8, weight: 0, ladder: 'test-lever', prog: 'double' }

  it('leaves an entry on its current step alone (same object)', () => {
    expect(ladderedEntry({ workouts: [] }, entry, skills)).toBe(entry)
  })

  it('swaps a promoted entry to the next variation with that step’s starting target', () => {
    const S = { workouts: [wk('2026-10-01', 'A', reps(12, 12, 12)), wk('2026-10-03', 'A', reps(12, 12, 12))] }
    const next = ladderedEntry(S, entry, skills)
    expect(next).toEqual({ id: 'B', sets: 3, mode: 'time', sec: 8, weight: 0, ladder: 'test-lever', prog: 'time' })
  })

  it('never moves an entry down: a harder step chosen by hand stays', () => {
    const hard = { id: 'C', sets: 3, mode: 'time', sec: 3, weight: 0, ladder: 'test-lever', prog: 'time' }
    expect(ladderedEntry({ workouts: [] }, hard, skills)).toBe(hard)
  })

  it('puts a placeholder exercise (not on the ladder) onto the current step', () => {
    const placeholder = { id: 'Q', sets: 3, reps: 6, weight: 0, ladder: 'test-lever' }
    expect(ladderedEntry({ workouts: [] }, placeholder, skills)).toMatchObject({ id: 'A', reps: 8, prog: 'double' })
  })

  it('ignores entries without a ladder, or with an unknown one', () => {
    const plain = { id: 'A', sets: 3, reps: 8 }
    expect(ladderedEntry({ workouts: [] }, plain, skills)).toBe(plain)
    const orphan = { ...entry, ladder: 'gone' }
    expect(ladderedEntry({ workouts: [] }, orphan, skills)).toBe(orphan)
  })

  it('keeps per-side and an added-load setting the user chose', () => {
    const S = { workouts: [wk('2026-10-01', 'A', reps(12, 12, 12)), wk('2026-10-03', 'A', reps(12, 12, 12))] }
    const next = ladderedEntry(S, { ...entry, side: true, bodyweight: true, rest: 120 }, skills)
    expect(next).toMatchObject({ id: 'B', side: true, bodyweight: true, rest: 120 })
  })

  it('applyLadders rewrites every routine in place and returns how many entries moved', () => {
    const S = {
      workouts: [wk('2026-10-01', 'A', reps(12, 12, 12)), wk('2026-10-03', 'A', reps(12, 12, 12))],
      routines: [{ id: 'r', ex: [entry, { id: 'Z', sets: 3, reps: 5 }] }, { id: 'r2' }]
    }
    expect(applyLadders(S, skills)).toBe(1)
    expect(S.routines[0].ex[0].id).toBe('B')
    expect(S.routines[0].ex[1].id).toBe('Z')
    expect(applyLadders(S, skills)).toBe(0)   // idempotent
  })
})

describe('entryDefaults / skillStatus', () => {
  it('gives a step’s routine entry with the in-step progression for its mode', () => {
    expect(entryDefaults(SKILL, 0)).toEqual({ id: 'A', sets: 3, reps: 8, weight: 0, ladder: 'test-lever', prog: 'double' })
    expect(entryDefaults(SKILL, 1)).toEqual({ id: 'B', sets: 3, mode: 'time', sec: 8, weight: 0, ladder: 'test-lever', prog: 'time' })
  })
  it('summarises a skill for its card', () => {
    const st = skillStatus({ workouts: [] }, SKILL)
    expect(st).toMatchObject({ index: 0, total: 3, mastered: false, step: SKILL.steps[0], next: SKILL.steps[1] })
    expect(st.fraction).toBeCloseTo(0)
  })
})

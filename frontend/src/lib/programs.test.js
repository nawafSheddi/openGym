// openBody built-in programs (lib/programs.js): enrolling writes ordinary routines and weekly-plan
// days without ever deleting what you had, laddered entries start on your current step, and the
// program's week, adherence and today's flow are derived from the log.
import { describe, it, expect } from 'vitest'
import { SKILLS } from './ladder.js'
import { PROGRAMS, programById, daysBetween, buildProgram, takenDays, enroll, programWeek, todaysFlow, adherence, leaveProgram, PROGRAM_SRC } from './programs.js'

let n = 0
const SKILLS_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]))
const ids = () => 'r' + (++n)
const PROG = {
  id: 'p', name: 'Test program', level: 'beginner', weeks: 4, description: 'x', assessEveryWeeks: 2,
  routines: [
    { key: 'a', name: 'A', emoji: 'pullup', ex: [{ id: '0001', sets: 3, reps: 8 }, { id: '0002', sets: 3, mode: 'time', sec: 20 }] },
    { key: 'b', name: 'B', emoji: 'legs', ex: [{ id: '0003', sets: 3, reps: 10 }], ladders: { 0: 'front-lever' } }
  ],
  schedule: [[1, 'a'], [3, 'b'], [5, 'a']],
  flows: [[2, 'hip-opener'], [6, 'morning-flow']]
}

describe('catalogue programs', () => {
  it('ships the 6 programs', () => {
    expect(PROGRAMS.map(p => p.id).sort()).toEqual(['fundamentals', 'hybrid', 'mobility-30', 'recommended-routine', 'skills-strength', 'splits-60'])
    expect(programById('fundamentals').routines.length).toBeGreaterThan(0)
    expect(programById('nope')).toBe(null)
  })
})

describe('buildProgram', () => {
  it('makes one tagged routine per program routine with calisthenics progression defaults', () => {
    n = 0
    const { routines, schedule } = buildProgram({ workouts: [] }, PROG, ids)
    expect(routines.map(r => [r.id, r.name, r.src])).toEqual([['r1', 'A', PROGRAM_SRC + 'p:a'], ['r2', 'B', PROGRAM_SRC + 'p:b']])
    expect(routines[0].ex[0]).toMatchObject({ id: '0001', weight: 0, prog: 'double' })
    expect(routines[0].ex[1]).toMatchObject({ id: '0002', weight: 0, prog: 'time' })
    expect(schedule).toEqual([{ day: 1, routineId: 'r1' }, { day: 3, routineId: 'r2' }, { day: 5, routineId: 'r1' }])
  })
  it('puts a laddered entry on the skill’s current step instead of the placeholder', () => {
    const { routines } = buildProgram({ workouts: [] }, PROG, ids)
    const e = routines[1].ex[0]
    expect(e.ladder).toBe('front-lever')
    expect(e.id).not.toBe('0003')          // the placeholder was replaced by the ladder's first step
  })
  it('never shares entry objects with the catalogue content', () => {
    const { routines } = buildProgram({ workouts: [] }, PROG, ids)
    routines[0].ex[0].sets = 99
    expect(PROG.routines[0].ex[0].sets).toBe(3)
  })
})

describe('real programs start laddered slots on the current step', () => {
  it('Skills & Strength puts a fresh user on the first step of every ladder it uses (not the strict muscle-up)', () => {
    const p = programById('skills-strength')
    const { routines } = buildProgram({ workouts: [] }, p, ids)
    const laddered = routines.flatMap(r => r.ex).filter(e => e.ladder)
    expect(laddered.length).toBeGreaterThan(0)
    for (const e of laddered) {
      const first = SKILLS_BY_ID[e.ladder].steps[0].exId
      expect(e.id, e.ladder).toBe(first)
    }
  })
})

describe('takenDays', () => {
  it('lists the program weekdays already holding one of your existing routines', () => {
    const S = { routines: [{ id: 'mine' }], week: { 1: ['mine'], 3: ['ghost'], 4: ['mine'] } }
    expect(takenDays(S, PROG)).toEqual([1])   // 3 holds a deleted routine, 4 is not a program day
  })
})

describe('enroll (on a draft state, as inside a store update)', () => {
  it('adds routines, sets only the program days, keeps everything else, and records the program', () => {
    n = 0
    const S = { routines: [{ id: 'mine', name: 'Mine', ex: [] }], week: { 0: ['mine'], 1: ['mine'] }, workouts: [] }
    enroll(S, PROG, { today: '2026-10-12', newId: ids })
    expect(S.routines.map(r => r.id)).toEqual(['mine', 'r1', 'r2'])
    expect(S.week).toEqual({ 0: ['mine'], 1: ['r1'], 3: ['r2'], 5: ['r1'] })
    expect(S.program).toEqual({ id: 'p', startedAt: '2026-10-12' })
  })
  it('enrolling again reuses the program’s routines instead of duplicating them', () => {
    n = 0
    const S = { routines: [], week: {}, workouts: [] }
    enroll(S, PROG, { today: '2026-10-12', newId: ids })
    enroll(S, PROG, { today: '2026-10-19', newId: ids })
    expect(S.routines.map(r => r.id)).toEqual(['r1', 'r2'])
    expect(S.program.startedAt).toBe('2026-10-19')
  })
  it('works on an openGym state with no week or program keys', () => {
    const S = { routines: [], workouts: [] }
    enroll(S, PROG, { today: '2026-10-12', newId: ids })
    expect(Object.keys(S.week).sort()).toEqual(['1', '3', '5'])
  })
  it('switching programs takes the previous program’s routines off its weekdays, keeping yours', () => {
    n = 0
    const S = { routines: [{ id: 'mine', name: 'Mine', ex: [] }], week: { 0: ['mine'] }, workouts: [] }
    enroll(S, PROG, { today: '2026-10-12', newId: ids })                       // Mon, Wed, Fri
    const OTHER = { ...PROG, id: 'q', schedule: [[2, 'a'], [4, 'a']] }           // Tue, Thu only
    enroll(S, OTHER, { today: '2026-10-19', newId: ids })
    expect(Object.keys(S.week).sort()).toEqual(['0', '2', '4'])
    expect(S.week[0]).toEqual(['mine'])
    expect(S.routines.filter(r => r.src?.startsWith(PROGRAM_SRC + 'p:'))).toHaveLength(2)   // still there
  })

  it('leaving keeps the routines and the plan, only the program goes', () => {
    const S = { routines: [], workouts: [] }
    enroll(S, PROG, { today: '2026-10-12', newId: ids })
    leaveProgram(S)
    expect(S.program).toBe(null)
    expect(S.routines).toHaveLength(2)
  })
})

describe('daysBetween', () => {
  it('rounds across daylight-saving changes (23 h and 25 h noon-to-noon are one day)', () => {
    const H = 3600000
    expect(daysBetween(0, 7 * 24 * H - H)).toBe(7)   // a week that contains the spring change
    expect(daysBetween(0, 24 * H + H)).toBe(1)        // the autumn change
    expect(daysBetween(0, 0)).toBe(0)
  })
})

describe('program progress', () => {
  const S = { program: { id: 'p', startedAt: '2026-10-05' }, workouts: [] }
  it('counts weeks from the start, capped, with done after the last week', () => {
    expect(programWeek(S, PROG, '2026-10-05')).toEqual({ week: 1, weeks: 4, done: false })
    expect(programWeek(S, PROG, '2026-10-13')).toEqual({ week: 2, weeks: 4, done: false })
    expect(programWeek(S, PROG, '2026-11-02')).toEqual({ week: 4, weeks: 4, done: true })
  })
  it('gives today’s scheduled flow', () => {
    expect(todaysFlow(PROG, '2026-10-13')).toBe('hip-opener')     // a Tuesday
    expect(todaysFlow(PROG, '2026-10-14')).toBe(null)
  })
  it('adherence: share of past scheduled sessions with the right kind of workout that day', () => {
    // Mon 5 (routine), Tue 6 (flow), Wed 7 (routine), Fri 9 (routine), Sat 10 (flow) up to Sun 11
    const W = { ...S, workouts: [
      { d: '2026-10-05', entries: [{ id: 'x' }] },                 // routine day done
      { d: '2026-10-06', flow: 'hip-opener', entries: [] },        // flow day done
      { d: '2026-10-09', flow: 'cool-down', entries: [] }          // a flow on a routine day: not it
    ] }
    expect(adherence(W, PROG, '2026-10-12')).toEqual({ done: 2, planned: 5 })
    expect(adherence({ workouts: [] }, PROG, '2026-10-12')).toEqual({ done: 0, planned: 0 })
  })
})

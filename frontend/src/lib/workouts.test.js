// openBody's ready-made workouts (lib/workouts.js): grouping for the Workouts screen, and turning
// one into an ordinary routine so it runs through the normal session, progression and history.
import { describe, it, expect } from 'vitest'
import { WORKOUTS, LEVELS, workoutGroups, workoutById, routineFromWorkout, workoutRoutineOf, WORKOUT_SRC, iconOfWorkout } from './workouts.js'

const w = (o) => ({ id: 'core-beginner', name: 'Core: Beginner', kind: 'muscle', group: 'core', level: 'beginner', goal: 'strength', minutes: 15, description: 'x', ex: [{ id: '0001', sets: 3, reps: 8 }], ...o })

describe('catalogue workouts', () => {
  it('ships the compiled content, every muscle group at three levels', () => {
    expect(WORKOUTS.length).toBeGreaterThanOrEqual(40)
    for (const g of ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'full-body'])
      for (const l of LEVELS) expect(WORKOUTS.some(x => x.kind === 'muscle' && x.group === g && x.level === l), `${g}/${l}`).toBe(true)
  })
  it('looks one up by id', () => {
    expect(workoutById('core-beginner')?.group).toBe('core')
    expect(workoutById('nope')).toBe(null)
  })
})

describe('workoutGroups', () => {
  const list = [w({ id: 'b', group: 'back', level: 'advanced' }), w({ id: 'a', group: 'back', level: 'beginner' }), w({ id: 'c', group: 'chest' }), w({ id: 'h', kind: 'area', group: 'hips' })]
  it('groups one kind in a fixed group order, levels easiest first', () => {
    const g = workoutGroups(list, 'muscle')
    expect(g.map(x => x.group)).toEqual(['chest', 'back'])
    expect(g[1].items.map(x => x.id)).toEqual(['a', 'b'])
  })
  it('filters by level when asked', () => {
    expect(workoutGroups(list, 'muscle', 'advanced').map(x => x.group)).toEqual(['back'])
  })
  it('groups areas by the area taxonomy', () => {
    expect(workoutGroups(list, 'area').map(x => x.group)).toEqual(['hips'])
  })
})

describe('routineFromWorkout', () => {
  it('copies the exercises into a routine tagged with its source, with fresh entry objects', () => {
    const src = w({ ex: [{ id: '0001', sets: 3, reps: 8, repsMin: 5 }, { id: '0002', sets: 2, mode: 'time', sec: 30, side: true }] })
    const r = routineFromWorkout(src, 'r1')
    expect(r).toMatchObject({ id: 'r1', name: 'Core: Beginner', emoji: 'abs', src: WORKOUT_SRC + 'core-beginner' })
    // calisthenics defaults: reps climb a range (double progression), holds add time
    expect(r.ex[0]).toEqual({ id: '0001', sets: 3, reps: 8, repsMin: 5, weight: 0, prog: 'double' })
    expect(r.ex[1]).toEqual({ id: '0002', sets: 2, mode: 'time', sec: 30, side: true, weight: 0, prog: 'time' })
    r.ex[0].sets = 9
    expect(src.ex[0].sets).toBe(3)   // the catalogue content is never written through
  })
  it('keeps a progression policy the content sets explicitly', () => {
    const r = routineFromWorkout(w({ ex: [{ id: '0001', sets: 5, reps: 5, prog: 'linear' }] }), 'r3')
    expect(r.ex[0].prog).toBe('linear')
  })

  it('drops entries whose exercise does not exist instead of crashing a session later', () => {
    const r = routineFromWorkout(w({ ex: [{ id: 'missing-id', sets: 3, reps: 8 }, { id: '0001', sets: 3, reps: 8 }] }), 'r2', id => id === '0001')
    expect(r.ex.map(e => e.id)).toEqual(['0001'])
  })
})

describe('workoutRoutineOf', () => {
  it('finds the routine a workout was already saved as, so Start now reuses it', () => {
    const S = { routines: [{ id: 'x', src: 'workout:core-beginner' }, { id: 'y' }] }
    expect(workoutRoutineOf(S, 'core-beginner').id).toBe('x')
    expect(workoutRoutineOf(S, 'back-advanced')).toBe(null)
    expect(workoutRoutineOf({}, 'core-beginner')).toBe(null)
  })
})

describe('iconOfWorkout', () => {
  it('picks an icon per group, and the stretch icon for area work', () => {
    expect(iconOfWorkout(w({ group: 'back' }))).toBe('pullup')
    expect(iconOfWorkout(w({ group: 'legs' }))).toBe('legs')
    expect(iconOfWorkout(w({ kind: 'area', group: 'hips' }))).toBe('stretch')
  })
})

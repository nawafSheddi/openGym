// @vitest-environment happy-dom
// Saving a ready-made workout as a routine (Start now / Add to plan): one routine per workout,
// reused on every later start, entries copied from the catalogue content.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api.js', () => ({ api: vi.fn() }))

import { useStore, DEF } from '../../store/useStore.js'
import { ensureWorkoutRoutine, prescription } from './WorkoutSheet.jsx'
import { WORKOUTS } from '../../lib/workouts.js'

const fresh = () => useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), routines: [] }, user: null })
afterEach(fresh)

describe('ensureWorkoutRoutine', () => {
  it('adds the workout as a tagged routine once, then reuses it', () => {
    fresh()
    const w = WORKOUTS.find(x => x.id === 'core-beginner')
    const id1 = ensureWorkoutRoutine(w)
    const id2 = ensureWorkoutRoutine(w)
    const { routines } = useStore.getState().S
    expect(id2).toBe(id1)
    expect(routines).toHaveLength(1)
    expect(routines[0]).toMatchObject({ id: id1, name: w.name, src: 'workout:core-beginner' })
    expect(routines[0].ex.length).toBe(w.ex.length)
  })

  it('keeps the user’s other routines untouched', () => {
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), routines: [{ id: 'mine', name: 'Mine', emoji: 'star', ex: [] }] } })
    ensureWorkoutRoutine(WORKOUTS[0])
    expect(useStore.getState().S.routines.map(r => r.id)[0]).toBe('mine')
    expect(useStore.getState().S.routines).toHaveLength(2)
  })
})

describe('prescription', () => {
  it('formats reps, rep ranges, holds and per-side work', () => {
    expect(prescription({ sets: 3, reps: 8 })).toBe('3 × 8')
    expect(prescription({ sets: 3, reps: 10, repsMin: 6 })).toBe('3 × 6–10')
    expect(prescription({ sets: 2, mode: 'time', sec: 30 })).toBe('2 × 30 s')
    expect(prescription({ sets: 2, mode: 'time', sec: 30, side: true })).toBe('2 × 30 s · per side')
  })
})

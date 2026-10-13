// @vitest-environment happy-dom
// Saving a ready-made workout as a routine (Start now / Add to plan): one routine per workout,
// reused on every later start, entries copied from the catalogue content.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api.js', () => ({ api: vi.fn() }))
const h = vi.hoisted(() => ({ startFlow: null, closeThenNav: null }))
vi.mock('../../sheets.jsx', () => ({ startFlow: (...a) => h.startFlow(...a), exerciseDetailSheet: () => {} }))
vi.mock('../../lib/nav.js', () => ({ closeThenNav: (...a) => h.closeThenNav(...a), nav: () => {} }))

import { useStore, DEF } from '../../store/useStore.js'
import { ensureWorkoutRoutine, prescription, startWorkoutNow } from './WorkoutSheet.jsx'
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

describe('startWorkoutNow', () => {
  it('never replaces a workout in progress: it goes back to it instead', () => {
    const running = { id: 'live', entries: [{ id: '0001', sets: [{ r: 8, done: true }] }] }
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), routines: [], active: running } })
    h.startFlow = vi.fn(); h.closeThenNav = vi.fn()
    expect(startWorkoutNow(WORKOUTS[0], () => {})).toBe(false)
    expect(h.startFlow).not.toHaveBeenCalled()
    expect(h.closeThenNav).toHaveBeenCalledWith(expect.any(Function), '/workout')
    expect(useStore.getState().S.active).toEqual(running)
  })
  it('starts a session from the saved routine when nothing is running', () => {
    fresh()
    h.startFlow = vi.fn(); h.closeThenNav = vi.fn()
    expect(startWorkoutNow(WORKOUTS[0], () => {})).toBe(true)
    expect(h.startFlow).toHaveBeenCalledWith([useStore.getState().S.routines[0].id])
  })
})

// openBody guided flows (lib/flow-player.js): the hands-free player as a pure state machine.
// Time is computed from timestamps, never from counted ticks, so a phone that sleeps, a tab that
// is backgrounded or a reload mid-hold resumes exactly where the clock says.
import { describe, it, expect } from 'vitest'
import { FLOWS, flowById, expandItems, init, tick, next, prev, pause, resume, remaining, current, isDone, totalSeconds, flowSession } from './flow-player.js'

const S = 1000   // ms per second, for readable times
const FLOW = {
  id: 'f', name: 'Test flow', transitionSec: 5,
  items: [
    { exId: 'A', sec: 30, cue: 'breathe' },
    { exId: 'B', sec: 20, side: true },
    { exId: 'A', sec: 10 }
  ]
}
const T0 = 1_000_000

describe('catalogue flows', () => {
  it('ships 12 flows', () => {
    expect(FLOWS).toHaveLength(12)
    expect(flowById('hip-opener')?.items.length).toBeGreaterThan(2)
    expect(flowById('nope')).toBe(null)
  })
})

describe('expandItems / totalSeconds', () => {
  it('lays a per-side hold out as a left and a right hold', () => {
    const steps = expandItems(FLOW)
    expect(steps.map(s => [s.exId, s.side])).toEqual([['A', null], ['B', 'L'], ['B', 'R'], ['A', null]])
  })
  it('counts holds and the transitions between them', () => {
    // holds 30 + 20 + 20 + 10 = 80, transitions before each of the 4 holds = 20
    expect(totalSeconds(FLOW)).toBe(100)
  })
})

describe('playing', () => {
  it('starts on a get-ready transition before the first hold', () => {
    const st = init(FLOW, T0)
    expect(current(st)).toMatchObject({ index: 0, phase: 'transition' })
    expect(remaining(st, T0 + 2 * S)).toBe(3)
  })

  it('moves transition -> hold -> next transition as time passes', () => {
    let st = init(FLOW, T0)
    st = tick(st, T0 + 5 * S)
    expect(current(st)).toMatchObject({ index: 0, phase: 'hold' })
    expect(remaining(st, T0 + 10 * S)).toBe(25)
    st = tick(st, T0 + 35 * S)
    expect(current(st)).toMatchObject({ index: 1, phase: 'transition' })
    expect(st.held[0]).toBe(30)
  })

  it('catches up across several phases after a long gap (phone asleep), without double-logging', () => {
    let st = init(FLOW, T0)
    st = tick(st, T0 + 61 * S)   // 5 + 30 + 5 + 20 = 60: one second into the R-side transition
    expect(current(st)).toMatchObject({ index: 2, phase: 'transition' })
    expect(st.held).toEqual([30, 20])
    expect(tick(st, T0 + 61 * S)).toEqual(st)   // the same instant again changes nothing
  })

  it('finishes after the last hold, and further ticks are no-ops', () => {
    let st = tick(init(FLOW, T0), T0 + 200 * S)
    expect(isDone(st)).toBe(true)
    expect(st.held).toEqual([30, 20, 20, 10])
    expect(tick(st, T0 + 999 * S)).toBe(st)
  })

  it('a flow with no transition goes straight from hold to hold', () => {
    const f = { ...FLOW, transitionSec: 0 }
    let st = init(f, T0)
    expect(current(st).phase).toBe('hold')
    st = tick(st, T0 + 30 * S)
    expect(current(st)).toMatchObject({ index: 1, phase: 'hold' })
  })
})

describe('pause / resume', () => {
  it('freezes the clock while paused and continues from the same second', () => {
    let st = tick(init(FLOW, T0), T0 + 10 * S)          // 5 s into the first hold
    st = pause(st, T0 + 10 * S)
    st = tick(st, T0 + 500 * S)                          // a long time paused: nothing moves
    expect(current(st)).toMatchObject({ index: 0, phase: 'hold' })
    st = resume(st, T0 + 500 * S)
    expect(remaining(st, T0 + 500 * S)).toBe(25)
    expect(remaining(st, T0 + 510 * S)).toBe(15)
  })

  it('pause and resume are idempotent', () => {
    const st = pause(init(FLOW, T0), T0)
    expect(pause(st, T0 + 9 * S)).toBe(st)
    const r = resume(st, T0 + 3 * S)
    expect(resume(r, T0 + 4 * S)).toBe(r)
  })

  it('survives a JSON round trip mid-hold (persisted in the store, app reloaded)', () => {
    const st = tick(init(FLOW, T0), T0 + 12 * S)
    const back = JSON.parse(JSON.stringify(st))
    expect(remaining(back, T0 + 12 * S)).toBe(remaining(st, T0 + 12 * S))
    expect(current(tick(back, T0 + 40 * S))).toEqual(current(tick(st, T0 + 40 * S)))
  })
})

describe('skip / back', () => {
  it('next during a hold records what was held so far and moves on', () => {
    let st = tick(init(FLOW, T0), T0 + 17 * S)          // 12 s into the first hold
    st = next(st, T0 + 17 * S)
    expect(st.held[0]).toBe(12)
    expect(current(st)).toMatchObject({ index: 1, phase: 'transition' })
  })

  it('next during a transition starts the hold now', () => {
    let st = init(FLOW, T0)
    st = next(st, T0 + 1 * S)
    expect(current(st)).toMatchObject({ index: 0, phase: 'hold' })
    expect(remaining(st, T0 + 1 * S)).toBe(30)
  })

  it('prev goes back to the previous hold and forgets what it logged', () => {
    let st = tick(init(FLOW, T0), T0 + 40 * S)           // into item 1's transition
    st = prev(st, T0 + 40 * S)
    expect(current(st)).toMatchObject({ index: 0, phase: 'transition' })
    expect(st.held[0]).toBeUndefined()
  })

  it('prev on the first item restarts it', () => {
    const st = prev(tick(init(FLOW, T0), T0 + 9 * S), T0 + 9 * S)
    expect(current(st)).toMatchObject({ index: 0, phase: 'transition' })
  })

  it('next on the last hold finishes the flow', () => {
    let st = tick(init(FLOW, T0), T0 + 95 * S)          // in the last hold
    st = next(st, T0 + 95 * S)
    expect(isDone(st)).toBe(true)
  })
})

describe('flowSession', () => {
  it('turns what was held into one workout entry per exercise, per-side holds as L/R rows', () => {
    const st = tick(init(FLOW, T0), T0 + 200 * S)
    const a = flowSession(st, FLOW, { id: 'w1', d: '2026-10-13' })
    expect(a).toMatchObject({ id: 'w1', d: '2026-10-13', start: T0, name: 'Test flow', flow: 'f', routineIds: [] })
    expect(a.entries.map(e => e.id)).toEqual(['A', 'B'])
    expect(a.entries[0].sets).toEqual([{ sec: 30, done: true }, { sec: 10, done: true }])
    expect(a.entries[0].target).toEqual({ sets: 2, mode: 'time', sec: 30 })
    expect(a.entries[1].sets).toEqual([{ sec: 20, done: true, side: 'L' }, { sec: 20, done: true, side: 'R' }])
    expect(a.entries[1].target).toEqual({ sets: 1, mode: 'time', sec: 20, side: true })
  })

  it('marks holds never reached (flow stopped early) as not done', () => {
    const st = next(tick(init(FLOW, T0), T0 + 20 * S), T0 + 20 * S)   // 15 s of the first hold, then stop
    const a = flowSession(st, FLOW, { id: 'w', d: 'x' })
    expect(a.entries[0].sets[0]).toEqual({ sec: 15, done: true })
    expect(a.entries[0].sets[1]).toEqual({ sec: 0, done: false })
  })
})

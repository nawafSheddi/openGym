// openBody guided flows: a hands-free mobility session that counts each hold down, gives a short
// get-ready between holds, does both sides of a unilateral stretch, and logs what you held.
//
// The player is a PURE state machine over plain, JSON-serialisable state, so the screen can keep
// it in the persisted store (S.activeFlow) and pick it up after a reload or a sleeping phone.
// Time is never counted in ticks. Every phase stores when it started (`phaseStart`, epoch ms),
// and `tick(state, now)` works out from the clock which phase we are in. A screen that fires
// tick every 250 ms, once a minute or once after waking up all land on the same state. While
// paused, `pausedAt` freezes that arithmetic; resume shifts `phaseStart` by the pause.
//
// Content: catalogue/flows/*.json → lib/content/flows.js ({ id, name, items: [{ exId, sec, side?,
// cue? }], transitionSec }). A flow becomes an ordinary workout at the end (flowSession → the
// app's buildCompletedWorkout), so history, streaks, the heatmap and the body map count it.
import FLOW_LIST from './content/flows.js'

export const FLOWS = FLOW_LIST
const BY_ID = Object.fromEntries(FLOWS.map(f => [f.id, f]))
export const flowById = id => BY_ID[id] || null

const MS = 1000

/** One hold per step: a per-side item becomes a left then a right hold. */
export function expandItems(flow) {
  const out = []
  ;(flow.items || []).forEach((it, item) => {
    const base = { exId: it.exId, sec: it.sec, cue: it.cue || '', item }
    if (it.side) out.push({ ...base, side: 'L' }, { ...base, side: 'R' })
    else out.push({ ...base, side: null })
  })
  return out
}

const transitionOf = flow => Math.max(0, Number(flow.transitionSec) || 0)

/** Seconds the whole flow takes: every hold plus the get-ready before each one. */
export function totalSeconds(flow) {
  const steps = expandItems(flow)
  return steps.reduce((n, s) => n + s.sec, 0) + steps.length * transitionOf(flow)
}

/** A fresh player at `now`, on the get-ready before the first hold (or the hold itself). */
export function init(flow, now) {
  const transitionSec = transitionOf(flow)
  return {
    flowId: flow.id, steps: expandItems(flow), transitionSec,
    i: 0, phase: transitionSec > 0 ? 'transition' : 'hold', phaseStart: now,
    pausedAt: null, startedAt: now, held: []
  }
}

const durOf = st => (st.phase === 'transition' ? st.transitionSec : st.steps[st.i].sec) * MS
// The instant the clock reads: frozen at the pause while paused.
const clock = (st, now) => (st.pausedAt != null ? st.pausedAt : now)

// Into the next step (or done), with its phase starting at `at`.
function advance(st, at) {
  if (st.i + 1 >= st.steps.length) return { ...st, phase: 'done', phaseStart: at }
  return { ...st, i: st.i + 1, phase: st.transitionSec > 0 ? 'transition' : 'hold', phaseStart: at }
}

/** The state at `now`: every phase whose time ran out is completed, in order, possibly several
 *  (after a long gap). Returns the same object when nothing changed. */
export function tick(st, now) {
  if (st.phase === 'done' || st.pausedAt != null) return st
  let s = st
  for (;;) {
    const end = s.phaseStart + durOf(s)
    if (now < end) break
    if (s.phase === 'transition') s = { ...s, phase: 'hold', phaseStart: end }
    else {
      const held = s.held.slice(); held[s.i] = s.steps[s.i].sec   // a hold that ran out was held in full
      s = advance({ ...s, held }, end)
      if (s.phase === 'done') break
    }
  }
  return s
}

/** Whole seconds left in the current phase (0 when done). */
export function remaining(st, now) {
  if (st.phase === 'done') return 0
  return Math.max(0, Math.ceil((durOf(st) - (clock(st, now) - st.phaseStart)) / MS))
}

/** Where the player is: `{ index, phase, step }` (step null when done). */
export const current = st => ({ index: st.i, phase: st.phase, step: st.phase === 'done' ? null : st.steps[st.i] })
export const isDone = st => st.phase === 'done'
export const isPaused = st => st.pausedAt != null

export function pause(st, now) {
  if (st.pausedAt != null || st.phase === 'done') return st
  return { ...tick(st, now), pausedAt: now }
}

export function resume(st, now) {
  if (st.pausedAt == null) return st
  return { ...st, phaseStart: st.phaseStart + (now - st.pausedAt), pausedAt: null }
}

/**
 * Skip ahead. On a get-ready: start the hold now. On a hold: log the seconds held so far and go
 * to the next step. Works while paused too (the new phase then waits, paused, at its start).
 */
export function next(st, now) {
  const s = tick(st, now)
  if (s.phase === 'done') return s
  const at = clock(s, now)
  const keepPaused = x => (s.pausedAt != null ? { ...x, pausedAt: at } : x)
  if (s.phase === 'transition') return keepPaused({ ...s, phase: 'hold', phaseStart: at })
  const held = s.held.slice(); held[s.i] = Math.floor((at - s.phaseStart) / MS)
  return keepPaused(advance({ ...s, held }, at))
}

/**
 * Go back: to the previous step (or the start of the first), from its get-ready. What was logged
 * from that step on is forgotten, because it is going to be done again.
 */
export function prev(st, now) {
  const s = tick(st, now)
  const at = clock(s, now)
  const target = s.phase === 'done' ? s.steps.length - 1 : Math.max(0, s.i - 1)
  const held = s.held.slice(0, target)
  return { ...s, i: target, held, phase: s.transitionSec > 0 ? 'transition' : 'hold', phaseStart: at, ...(s.pausedAt != null ? { pausedAt: at } : {}) }
}

/**
 * The flow as a session object in the shape the app's buildCompletedWorkout reads
 * (lib/finish-workout.js): one entry per exercise in order of first appearance, each hold a set
 * `{ sec, done }`, per-side holds as adjacent L/R rows (how the app logs a per-side timed hold),
 * and a time target so progression and history read it like any timed exercise.
 */
export function flowSession(st, flow, { id, d }) {
  const entries = []
  const byEx = new Map()
  st.steps.forEach((step, k) => {
    let e = byEx.get(step.exId)
    if (!e) {
      const item = flow.items[step.item]
      e = { id: step.exId, sets: [], target: { sets: 0, mode: 'time', sec: item.sec, ...(item.side ? { side: true } : {}) }, _items: new Set() }
      byEx.set(step.exId, e); entries.push(e)
    }
    // count planned sets per flow item (a per-side item is one set of two rows)
    if (!e._items.has(step.item)) { e._items.add(step.item); e.target.sets++ }
    const sec = Number(st.held[k]) || 0
    e.sets.push({ sec, done: sec > 0, ...(step.side ? { side: step.side } : {}) })
  })
  entries.forEach(e => { delete e._items })
  return { id, d, start: st.startedAt, routineIds: [], name: flow.name, flow: flow.id, bw: null, cur: 0, entries }
}

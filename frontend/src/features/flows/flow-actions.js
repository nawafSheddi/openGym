// Actions for guided flows. The player state lives on this device only (flow-store.js), never in
// the synced store, so another tab or device can never log the same flow again; the workout a
// finished flow produces is ordinary synced data. lib/flow-player.js computes everything from
// timestamps, so a reload resumes.
import { useStore } from '../../store/useStore.js'
import { init, flowSession } from '../../lib/flow-player.js'
import { buildCompletedWorkout } from '../../lib/finish-workout.js'
import { workoutVolume } from '../../lib/history.js'
import { EXIDX, isCustomEx } from '../../lib/exercises.js'
import { exerciseMuscleSnapshot } from '../../lib/muscles.js'
import { uid, todayISO } from '../../lib/format.js'
import { nav } from '../../lib/nav.js'
import { getActiveFlow, setActiveFlow } from './flow-store.js'

/** Start (or restart) a flow now and open the player. */
export function startFlowPlayer(flow, now = Date.now()) {
  setActiveFlow(init(flow, now))
  nav('/flow')
}

/** Persist a newer player state (the screen calls this when the phase changes). */
export const saveFlowState = st => setActiveFlow(st)

/** Stop without logging anything. */
export const discardFlow = () => setActiveFlow(null)

/**
 * Log the flow as an ordinary workout (what was actually held; holds never reached are left out
 * by buildCompletedWorkout) and clear the player. Returns the saved workout, or null when nothing
 * was held (then nothing is written, but the player is still cleared).
 *
 * Guarded against a second log of the same flow: it only logs while that flow is still the one
 * running on this device (same `startedAt`). A finish that arrives after the flow was already
 * logged (the timer ran out while "End this flow?" was open, then "Save and end" was tapped) is
 * a no-op.
 */
export function finishFlow(st, flow, now = Date.now()) {
  const running = getActiveFlow()
  if (!running || running.startedAt !== st.startedAt) return null
  setActiveFlow(null)
  const session = flowSession(st, flow, { id: uid(), d: todayISO() })
  const w = buildCompletedWorkout(session, {
    end: now,
    // custom exercises carry their own muscle data into history, as a normal finish does
    snapshotFor: e => (isCustomEx(EXIDX[e.id]) ? exerciseMuscleSnapshot(EXIDX[e.id]) : null)
  })
  w.flow = flow.id   // which guided flow this was (History and Stats can tell flows apart)
  // History lists every workout's volume; a normal finish sets it the same way (0 for holds).
  w.vol = workoutVolume(w)
  if (!w.entries.length) return null
  useStore.getState().update(s => { s.workouts.push(w) })
  useStore.getState().autoBackupNow?.()
  return w
}

// Store actions for guided flows. The player state lives in the persisted store as
// `S.activeFlow` (absent/null = no flow running), so a reload or a sleeping phone resumes it:
// lib/flow-player.js computes everything from timestamps.
import { useStore } from '../../store/useStore.js'
import { init, flowSession } from '../../lib/flow-player.js'
import { buildCompletedWorkout } from '../../lib/finish-workout.js'
import { workoutVolume } from '../../lib/history.js'
import { EXIDX, isCustomEx } from '../../lib/exercises.js'
import { exerciseMuscleSnapshot } from '../../lib/muscles.js'
import { uid, todayISO } from '../../lib/format.js'
import { nav } from '../../lib/nav.js'

/** Start (or restart) a flow now and open the player. */
export function startFlowPlayer(flow, now = Date.now()) {
  useStore.getState().update(s => { s.activeFlow = init(flow, now) })
  nav('/flow')
}

/** Persist a newer player state (the screen calls this when the phase changes). */
export function saveFlowState(st) {
  useStore.getState().update(s => { s.activeFlow = st })
}

/** Stop without logging anything. */
export function discardFlow() {
  useStore.getState().update(s => { s.activeFlow = null })
}

/**
 * Log the flow as an ordinary workout (what was actually held; holds never reached are left
 * out by buildCompletedWorkout) and clear the player. Returns the saved workout, or null when
 * nothing was held at all (then nothing is written but the player is still cleared).
 */
export function finishFlow(st, flow, now = Date.now()) {
  const session = flowSession(st, flow, { id: uid(), d: todayISO() })
  const w = buildCompletedWorkout(session, {
    end: now,
    // custom exercises carry their own muscle data into history, as a normal finish does
    snapshotFor: e => (isCustomEx(EXIDX[e.id]) ? exerciseMuscleSnapshot(EXIDX[e.id]) : null)
  })
  w.flow = flow.id   // which guided flow this was (History and Stats can tell flows apart)
  // History lists every workout's volume; a normal finish sets it the same way (0 for holds).
  w.vol = workoutVolume(w)
  const keep = w.entries.length > 0
  useStore.getState().update(s => {
    if (keep) s.workouts.push(w)
    s.activeFlow = null
  })
  if (keep) useStore.getState().autoBackupNow?.()
  return keep ? w : null
}

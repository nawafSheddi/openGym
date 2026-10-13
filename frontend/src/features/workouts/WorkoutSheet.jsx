// The sheet a ready-made workout opens in: what is in it, and two ways to use it.
//   · Start now   — saves it as a routine (or reuses the copy saved before) and starts a session.
//   · Add to plan — saves it as a routine and opens it in the routine editor, where it can be put
//                   on weekdays like any routine.
// Both go through lib/workouts.js, so the session that follows is an ordinary routine session:
// progression, history and stats work with no special case.
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t, exerciseNameFor, exerciseNameClass } from '../../lib/i18n.js'
import { EXIDX } from '../../lib/exercises.js'
import { uid } from '../../lib/format.js'
import { routineFromWorkout, workoutRoutineOf } from '../../lib/workouts.js'
import { closeThenNav } from '../../lib/nav.js'
import { Thumb } from '../../components/Media.jsx'
import { Button } from '../../components/ui.jsx'
import { tappable } from '../../lib/use-sheet-keyboard.js'
import { startFlow, exerciseDetailSheet } from '../../sheets.jsx'
import { levelLabel, minutesLabel } from './labels.js'

/** "3 × 8", "3 × 6–10", "3 × 30 s", with "per side" for unilateral work. */
export function prescription(e) {
  const reps = e.mode === 'time' ? t('{0} s', e.sec) : (e.repsMin && e.repsMin < e.reps ? `${e.repsMin}–${e.reps}` : String(e.reps))
  return `${e.sets} × ${reps}` + (e.side ? ' · ' + t('per side') : '')
}

/**
 * The routine id for this workout: the copy saved earlier, or a new one added now.
 * Entries whose exercise this build does not know are dropped (routineFromWorkout).
 */
export function ensureWorkoutRoutine(w) {
  const existing = workoutRoutineOf(useStore.getState().S, w.id)
  if (existing) return existing.id
  const r = routineFromWorkout(w, uid(), id => !!EXIDX[id])
  useStore.getState().update(s => { (s.routines = s.routines || []).push(r) })
  return r.id
}

/**
 * Start a ready-made workout now. A workout already running is never replaced (beginWorkout
 * overwrites S.active, and every set logged in it would be gone): it goes back to that one
 * instead, the way Home's Start does. Returns true when a new session was started.
 */
export function startWorkoutNow(w, close) {
  if (useStore.getState().S.active) {
    useUI.getState().toast(t('A workout is in progress. Finish or discard it first.'))
    closeThenNav(close, '/workout')
    return false
  }
  const rid = ensureWorkoutRoutine(w); close(); startFlow([rid])
  return true
}

function WorkoutSheet({ w, close }) {
  const saved = useStore(s => workoutRoutineOf(s.S, w.id))
  const start = () => startWorkoutNow(w, close)
  const addToPlan = () => {
    const rid = ensureWorkoutRoutine(w)
    useUI.getState().toast(t('“{0}” is in your plan', w.name))
    closeThenNav(close, '/plan/r/' + rid)
  }
  return <>
    <h3>{w.name}</h3>
    <div className="muted small" style={{ marginBottom: 6 }}>{levelLabel(w.level)} · {minutesLabel(w.minutes)}</div>
    {w.description && <p className="small" style={{ margin: '0 0 12px', lineHeight: 1.4 }}>{w.description}</p>}
    <div className="list" style={{ marginBottom: 14 }}>
      {w.ex.map((e, i) => {
        const ex = EXIDX[e.id]
        if (!ex) return null   // unknown in this build: skipped, as the saved routine skips it
        return <div key={i} className="item" {...tappable(() => exerciseDetailSheet(ex))}>
          <Thumb ex={ex} />
          <div className="grow"><div className={`tt ${exerciseNameClass(ex)}`}>{exerciseNameFor(ex)}</div>
            <div className="ss">{prescription(e)}</div></div>
        </div>
      })}
    </div>
    <Button variant="primary" icon="play" onClick={start}>{t('Start now')}</Button>
    <div style={{ height: 8 }} />
    <Button icon={saved ? 'pencil' : 'plus'} onClick={addToPlan}>{saved ? t('Open in your plan') : t('Add to plan')}</Button>
  </>
}

export const workoutSheet = w => useUI.getState().openSheet(close => <WorkoutSheet w={w} close={close} />)

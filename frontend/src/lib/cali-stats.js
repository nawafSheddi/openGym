// Numbers for openBody's Stats additions. Pure functions over the workout log; the Stats screen
// only renders them.
//   · weeklyTime: seconds of strength holds (planche, L-sit, plank…) vs seconds of mobility work
//     per week. Mobility = a guided flow (every hold in it), or any exercise whose catalogue
//     category is mobility / stretching / yoga / rehab. Timed sets only; reps carry no time.
//   · skillSummary: how far up the 12 skill ladders you are (lib/ladder.js).
//   · hasLoadedWork: whether a 1RM-style view (structural balance) means anything for this log.
import { EXIDX } from './exercises.js'
import { isMobilityEx } from './areas.js'
import { isWarmupRow } from './workout-model.js'
import { SKILLS, currentStep } from './ladder.js'

const dayMs = 86400000
const at = iso => new Date(iso + 'T12:00:00').getTime()
const isoOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// Monday of the week an ISO date falls in (Stats weeks start on Monday here).
const mondayOf = iso => { const d = new Date(iso + 'T12:00:00'); const back = (d.getDay() + 6) % 7; return isoOf(d.getTime() - back * dayMs) }

const defaultIsMobility = id => isMobilityEx(EXIDX[id])

/**
 * The last `weeks` weeks ending with the one `today` is in, oldest first:
 * `[{ weekStart, holdSec, mobilitySec }]`. `isMob(exerciseId)` is injectable for tests.
 */
export function weeklyTime(S, today, weeks = 8, isMob = defaultIsMobility) {
  const last = mondayOf(today)
  const out = []
  for (let k = weeks - 1; k >= 0; k--) out.push({ weekStart: isoOf(at(last) - k * 7 * dayMs), holdSec: 0, mobilitySec: 0 })
  const byWeek = Object.fromEntries(out.map(x => [x.weekStart, x]))
  for (const w of S?.workouts || []) {
    const bucket = w?.d && byWeek[mondayOf(w.d)]
    if (!bucket) continue
    for (const e of w.entries || []) {
      const mob = !!w.flow || isMob(e.id)
      for (const s of e.sets || []) {
        if (!s || !s.done || isWarmupRow(s) || !(Number(s.sec) > 0)) continue
        if (mob) bucket.mobilitySec += Number(s.sec)
        else bucket.holdSec += Number(s.sec)
      }
    }
  }
  return out
}

/** `{ total, mastered, stepsUnlocked, started }` across the skill ladders. */
export function skillSummary(S, skills = SKILLS) {
  let mastered = 0, stepsUnlocked = 0, started = 0
  for (const skill of skills) {
    const { index, mastered: m } = currentStep(S, skill)
    // steps behind you: everything below the current step, plus the last one once mastered
    const unlocked = m ? skill.steps.length : index
    stepsUnlocked += unlocked
    if (m) mastered++
    if (unlocked > 0) started++
  }
  return { total: skills.length, mastered, stepsUnlocked, started }
}

/** Whether any logged set that was done carried external load (a weighted pull-up, a barbell). */
export function hasLoadedWork(S) {
  return (S?.workouts || []).some(w => (w.entries || []).some(e => (e.sets || []).some(s => s && s.done && Number(s.w) > 0)))
}

// openBody skill ladders: front lever, planche, handstand, muscle-up… each an ordered list of
// variations (catalogue/skills/, compiled to lib/content/skills.js), each step with the bar you
// have to clear to move on ("3 × 15 s, in 2 separate sessions").
//
// How it fits the progression engine (lib/progression.js), and why it is a layer in front of it
// rather than a policy inside it:
//   · WITHIN a step, the existing, tested policies do the work: `time` adds seconds to a hold,
//     `double` climbs reps through a range. Nothing new to get wrong there.
//   · BETWEEN steps, this module swaps the routine entry's exercise for the next variation, with
//     that step's starting target. The engine then sees a new exercise with no history and
//     prescribes "first session sets the baseline", which is exactly right after a promotion.
//   · The swap is applied to the ROUTINE (applyLadders, run when a session starts and when one
//     is saved), not only to the session, so the Plan shows the variation you are actually on
//     and finish-workout's write-back matches entries by the right id.
//
// Like the engine, where you stand is DERIVED from the workout log every time, never stored: fix
// a mistyped hold and the ladder follows. The only stored input is `S.skillOverrides[skillId]`,
// a floor set by "I can already do this" on the skill screen.
// Pure functions over plain data: no store, no I/O.
import SKILL_LIST from './content/skills.js'
import { isWarmupRow } from './workout-model.js'

export const SKILLS = SKILL_LIST
const BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]))
export const skillById = id => BY_ID[id] || null

// The progression policy that runs inside a step, by the step's logging mode.
const IN_STEP_POLICY = { time: 'time', reps: 'double' }

// Routine-entry settings that belong to the person, not to the step: they survive a promotion.
// (Superset grouping, per-side, the bodyweight/added-load switch, rest and the exercise note.)
const KEEP = ['side', 'bodyweight', 'rest', 'note', 'sg', 'sgName', 'sgRest', 'noProg']

/** The value a done set carries for a step's mode: seconds held, or reps done. */
const valueOf = (set, mode) => (mode === 'time' ? Number(set.sec) || 0 : Number(set.r) || 0)

/**
 * Whether one logged entry clears a step's unlock bar: at least `unlock.sets` sets checked off
 * at or above `unlock.sec` / `unlock.reps`. Warm-up rows and sets never checked off don't count.
 */
export function sessionMeets(entry, step) {
  const bar = step.mode === 'time' ? step.unlock.sec : step.unlock.reps
  const good = (entry?.sets || []).filter(s => s && s.done && !isWarmupRow(s) && valueOf(s, step.mode) >= bar)
  return good.length >= step.unlock.sets
}

/** How many separate workouts cleared this step's bar (a workout counts once). */
export function metSessions(S, step) {
  let n = 0
  for (const w of S?.workouts || []) {
    if ((w.entries || []).some(e => e && e.id === step.exId && sessionMeets(e, step))) n++
  }
  return n
}

const stepMet = (S, step) => metSessions(S, step) >= step.unlock.sessions

/**
 * Where you stand on a skill: `{ index, mastered }`. The index is the step after the highest
 * step you have met (an easier step you skipped does not hold you back), floored by a manual
 * override and clamped to the ladder. Mastered = the last step's bar has been met.
 */
export function currentStep(S, skill) {
  const last = skill.steps.length - 1
  let highest = -1
  skill.steps.forEach((st, i) => { if (stepMet(S, st)) highest = i })
  const mastered = highest === last
  const derived = Math.min(highest + 1, last)
  const raw = S?.skillOverrides?.[skill.id]
  const floor = Number.isInteger(raw) ? Math.max(0, Math.min(raw, last)) : 0
  return { index: Math.max(derived, floor), mastered }
}

/** Progress towards one step's bar: sessions met so far, sessions needed, best single set. */
export function unlockProgress(S, skill, i) {
  const step = skill.steps[i]
  let best = 0
  for (const w of S?.workouts || []) for (const e of w.entries || []) {
    if (!e || e.id !== step.exId) continue
    for (const s of e.sets || []) if (s && s.done && !isWarmupRow(s)) best = Math.max(best, valueOf(s, step.mode))
  }
  return { sessionsMet: metSessions(S, step), sessionsNeeded: step.unlock.sessions, best, unit: step.mode === 'time' ? 'sec' : 'reps' }
}

/** A routine entry for one step of a skill: the step's exercise and starting target, following
 *  the ladder, with the in-step progression for its mode. */
export function entryDefaults(skill, i) {
  const st = skill.steps[i]
  const base = st.mode === 'time'
    ? { id: st.exId, sets: st.target.sets, mode: 'time', sec: st.target.sec }
    : { id: st.exId, sets: st.target.sets, reps: st.target.reps }
  return { ...base, weight: 0, ladder: skill.id, prog: IN_STEP_POLICY[st.mode] }
}

/**
 * The routine entry as it should be now: unchanged (the same object) when it is on its current
 * step or a harder one, otherwise the current step's entry with the person's own settings kept.
 * An entry whose exercise is not on the ladder at all (a program's placeholder) is put on the
 * current step. Entries without a known ladder are returned as they are.
 */
export function ladderedEntry(S, entry, skills = SKILLS) {
  const skill = entry?.ladder && skills.find(s => s.id === entry.ladder)
  if (!skill) return entry
  const { index } = currentStep(S, skill)
  const at = skill.steps.findIndex(st => st.exId === entry.id)
  if (at >= index) return entry            // on it, or ahead of it by choice: never move down
  const next = entryDefaults(skill, index)
  for (const k of KEEP) if (entry[k] !== undefined) next[k] = entry[k]
  return next
}

/**
 * Bring every routine's laddered entries up to date, IN PLACE (call it inside a store update).
 * Returns how many entries moved, so a caller can tell the user.
 */
export function applyLadders(S, skills = SKILLS) {
  let moved = 0
  for (const r of S?.routines || []) {
    if (!Array.isArray(r.ex)) continue
    r.ex = r.ex.map(e => {
      const n = ladderedEntry(S, e, skills)
      if (n !== e) moved++
      return n
    })
  }
  return moved
}

/** Everything a skill card shows: current/next step, how far along the ladder, mastered. */
export function skillStatus(S, skill) {
  const { index, mastered } = currentStep(S, skill)
  const total = skill.steps.length
  return {
    index, total, mastered,
    step: skill.steps[index],
    next: skill.steps[index + 1] || null,
    // share of the ladder behind you: mastered = 1, first step not met = 0
    fraction: mastered ? 1 : index / total,
    progress: unlockProgress(S, skill, index)
  }
}

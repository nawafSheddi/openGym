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
import { isWarmupRow, isSideSet } from './workout-model.js'

export const SKILLS = SKILL_LIST
const BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]))
export const skillById = id => BY_ID[id] || null

// The progression policy that runs inside a step, by the step's logging mode.
const IN_STEP_POLICY = { time: 'time', reps: 'double' }

// Routine-entry settings that belong to the person, not to the step: they survive a promotion.
// (Superset grouping, per-side, the bodyweight/added-load switch, rest and the exercise note.)
const KEEP = ['side', 'bodyweight', 'rest', 'note', 'sg', 'sgName', 'sgRest', 'noProg']

/** The value one row carries for a step's mode: seconds held, or reps done. */
const valueOf = (set, mode) => (mode === 'time' ? Number(set.sec) || 0 : Number(set.r) || 0)

/**
 * A logged entry's work sets as `[{ v, done }]`, with unilateral work scored PER SIDE by the
 * weaker side (code review, 2026-10-13: a per-side row's `r` is the L+R total, so 5 + 5 used to
 * clear a "10 per side" bar):
 *   · a per-side reps set carries `sides: { L, R }`: v = the smaller side, done only if both are;
 *   · a per-side timed hold is logged as an L row then an R row: each adjacent pair is one set;
 *     a side without its partner counts as a set with nothing on the missing side.
 * Warm-up rows are left out.
 */
export function workSets(entry, mode) {
  const rows = (entry?.sets || []).filter(s => s && !isWarmupRow(s))
  const out = []
  for (let k = 0; k < rows.length; k++) {
    const s = rows[k]
    if (isSideSet(s)) {
      out.push({ v: Math.min(valueOf(s.sides.L, mode), valueOf(s.sides.R, mode)), done: !!(s.sides.L.done && s.sides.R.done) })
    } else if (s.side === 'L' && rows[k + 1]?.side === 'R') {
      const r = rows[++k]
      out.push({ v: Math.min(valueOf(s, mode), valueOf(r, mode)), done: !!(s.done && r.done) })
    } else if (s.side === 'L' || s.side === 'R') {
      out.push({ v: 0, done: false })        // half a pair: the other side was never logged
    } else {
      out.push({ v: valueOf(s, mode), done: !!s.done })
    }
  }
  return out
}

/**
 * Whether one logged entry clears a step's unlock bar: at least `unlock.sets` sets checked off
 * at or above `unlock.sec` / `unlock.reps` (per side for unilateral work, see workSets).
 */
export function sessionMeets(entry, step) {
  const bar = step.mode === 'time' ? step.unlock.sec : step.unlock.reps
  return workSets(entry, step.mode).filter(x => x.done && x.v >= bar).length >= step.unlock.sets
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
 * The manual floor for one skill, or null. Stored per skill as a stamped `{ v, _ts }` so two
 * devices merge per skill, the later choice winning, and a clear (`v: null`) is a choice too
 * (lib/sync-merge.js STAMPED_MAPS). A bare number (written before stamping) still reads.
 */
export function overrideOf(S, skillId) {
  const o = S?.skillOverrides?.[skillId]
  const v = o && typeof o === 'object' ? o.v : o
  return Number.isInteger(v) ? v : null
}

/** The stamped entry that sets (or with null, clears) a skill's floor. */
export const overrideEntry = (index, now = Date.now()) => ({ v: Number.isInteger(index) ? index : null, _ts: now })

/**
 * Where you stand on a skill: `{ index, mastered }`. The index is the step after the highest
 * step you have met (an easier step you skipped does not hold you back), floored by a manual
 * override and clamped to the ladder. Mastered = the last step's bar has been met.
 */
export function currentStep(S, skill) {
  const last = skill.steps.length - 1
  let highest = -1
  skill.steps.forEach((st, i) => { if (stepMet(S, st)) highest = i })
  const derived = Math.min(highest + 1, last)
  // The override is "the step I'm on": "I can already do step i" stores i + 1, so a claim past
  // the last step means the whole ladder is mastered (code review, 2026-10-13).
  const claimed = overrideOf(S, skill.id) ?? 0
  const floor = Math.max(0, Math.min(claimed, last))
  return { index: Math.max(derived, floor), mastered: highest === last || claimed > last }
}

/** Progress towards one step's bar: sessions met so far, sessions needed, best single set. */
export function unlockProgress(S, skill, i) {
  const step = skill.steps[i]
  let best = 0
  for (const w of S?.workouts || []) for (const e of w.entries || []) {
    if (!e || e.id !== step.exId) continue
    for (const x of workSets(e, step.mode)) if (x.done) best = Math.max(best, x.v)
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

// The current step's entry for `skill`, carrying the person's own settings over (KEEP). On a
// per-side entry a reps target is doubled: steps state reps per side, the app logs per-side reps
// as the L+R total (history.js isPerSide/repStep).
function stepEntry(skill, index, from) {
  const next = entryDefaults(skill, index)
  for (const k of KEEP) if (from[k] !== undefined) next[k] = from[k]
  if (next.side && next.reps) next.reps *= 2
  return next
}

/**
 * The routine entry as it should be now. It moves UP to the current step when it is on an
 * easier step of its ladder. It is returned unchanged (the same object) when it is on the
 * current step or a harder one (never moved down), when its exercise is not on the ladder at all
 * (the person replaced it: their choice, code review 2026-10-13), or without a known ladder.
 */
export function ladderedEntry(S, entry, skills = SKILLS) {
  const skill = entry?.ladder && skills.find(s => s.id === entry.ladder)
  if (!skill) return entry
  const { index } = currentStep(S, skill)
  const at = skill.steps.findIndex(st => st.exId === entry.id)
  if (at < 0 || at >= index) return entry
  return stepEntry(skill, index, entry)
}

/**
 * Program enrollment: a laddered entry starts exactly on the person's current step, whether the
 * program's content put an easier step, a harder one or a placeholder there (a program must not
 * start a beginner on the strict muscle-up, code review 2026-10-13). Unknown ladders unchanged.
 */
export function onCurrentStep(S, entry, skills = SKILLS) {
  const skill = entry?.ladder && skills.find(s => s.id === entry.ladder)
  if (!skill) return entry
  return stepEntry(skill, currentStep(S, skill).index, entry)
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

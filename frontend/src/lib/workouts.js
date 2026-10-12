// openBody's ready-made workouts: sessions per muscle group (chest … full body, three levels each)
// and per mobility area, authored in catalogue/workouts/ and compiled to lib/content/workouts.js.
//
// A ready-made workout is never run "as content". Starting it or adding it to the plan turns it
// into an ORDINARY routine (routineFromWorkout), tagged `src: 'workout:<id>'`, so everything the
// app already does for routines applies unchanged: the session screen, progression, history,
// supersets, sync. The tag lets "Start now" reuse the copy made last time (workoutRoutineOf), so
// doing "Pull: Beginner" three times builds one progression history rather than three routines.
// Pure: no store access; callers pass state in and write the result themselves.
import WORKOUT_LIST from './content/workouts.js'
import { AREA_IDS } from './areas.js'

export const WORKOUTS = WORKOUT_LIST
export const LEVELS = ['beginner', 'intermediate', 'advanced']
// Display order of the muscle groups (push/pull/legs flow, full body last).
export const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'full-body']
export const WORKOUT_SRC = 'workout:'

const BY_ID = Object.fromEntries(WORKOUTS.map(w => [w.id, w]))
export const workoutById = id => BY_ID[id] || null

// Routine icons (components/Icon.jsx names) per muscle group; area work is stretching.
const GROUP_ICON = { chest: 'figureStrength', back: 'pullup', shoulders: 'arm', arms: 'arm', core: 'abs', legs: 'legs', 'full-body': 'figureStrength' }
export const iconOfWorkout = w => (w.kind === 'area' ? 'stretch' : GROUP_ICON[w.group] || 'figureStrength')

/**
 * Workouts of one kind grouped for display: [{ group, items }] in the fixed group order (muscle
 * groups above, or the area taxonomy), items easiest level first then by name. `level` narrows
 * to one level; groups left empty are dropped.
 */
export function workoutGroups(list, kind, level = '') {
  const order = kind === 'area' ? AREA_IDS : MUSCLE_GROUPS
  const rank = w => LEVELS.indexOf(w.level)
  return order
    .map(group => ({
      group,
      items: list
        .filter(w => w.kind === kind && w.group === group && (!level || w.level === level))
        .sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : 1))
    }))
    .filter(g => g.items.length)
}

/**
 * The workout as a new routine object (not yet in state). Entries are copied, never shared with
 * the catalogue content, and get `weight: 0` like every routine entry the app creates.
 * `exists(id)` filters out entries whose exercise this build does not know (content edited
 * later, a custom catalogue): a session would show them as "Unknown exercise" otherwise.
 */
export function routineFromWorkout(w, id, exists = () => true) {
  return {
    id,
    name: w.name,
    emoji: iconOfWorkout(w),
    src: WORKOUT_SRC + w.id,
    ex: w.ex.filter(e => exists(e.id)).map(e => ({ ...e, weight: 0, prog: e.prog || defaultPolicy(e) }))
  }
}

/**
 * The progression a calisthenics entry starts with when the content does not say: reps climb
 * through their range before anything else changes (double progression), holds add seconds
 * (time). The app's own default, linear, adds weight, which bodyweight work rarely has.
 * Shared with program enrollment (lib/programs.js).
 */
export const defaultPolicy = e => (e.mode === 'time' ? 'time' : 'double')

/** The routine this workout was saved as before, or null. */
export function workoutRoutineOf(S, workoutId) {
  return (S?.routines || []).find(r => r.src === WORKOUT_SRC + workoutId) || null
}

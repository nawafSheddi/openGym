// openBody content checks: skill ladders, workouts, guided flows, flexibility assessments,
// programs and the mobility area taxonomy (catalogue/{skills,workouts,flows,assessments,
// programs}/*.json and catalogue/areas.json). The schemas are documented in
// docs/superpowers/plans/2026-10-13-openbody.md ("Content schemas").
//
// Two parts, so the rules can be tested without touching the disk:
//   · checkContent(content, exercises) — PURE. Every rule lives here. Returns the content sorted
//     by id (stable build output) and a list of "<file>: <what is wrong>" problems.
//   · loadContent(dir) — reads the JSON files into the shape checkContent expects.
// validate.mjs runs both, so CI and build.mjs refuse broken content the same way they refuse a
// broken exercise.
//
// The rules exist because content and code meet at runtime: a ladder step pointing at an
// exercise id that does not exist would crash the skill tree, a band list out of order would put
// a toe-touch of +30 cm in "poor", a schedule naming a missing routine would enrol a program with
// a hole in its week. Catching these at build time is far cheaper than at the user's phone.
import fs from 'node:fs'
import path from 'node:path'
import { MUSCLES } from './validate.mjs'

// ---- vocabularies (shared with the app; changing one needs app support first) ----
export const FAMILIES = ['push', 'pull', 'legs', 'core', 'balance']
export const LEVELS = ['beginner', 'intermediate', 'advanced']
export const GOALS = ['strength', 'skill', 'mobility', 'conditioning']
export const KINDS = ['muscle', 'area']
export const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'full-body']
export const UNITS = ['cm', 'deg', 's']
export const BETTER = ['higher', 'lower']
export const BAND_LABELS = ['poor', 'fair', 'good', 'great', 'elite']
export const TYPES = ['skills', 'workouts', 'flows', 'assessments', 'programs']

const isText = s => typeof s === 'string' && s.trim() === s && s.length > 0
const isPosInt = n => Number.isInteger(n) && n > 0
const isNum = n => typeof n === 'number' && Number.isFinite(n)
// Same copy rule as the exercise text (validate.mjs): no em dashes in anything a user reads.
const EM = '—'

/**
 * Validate a whole content set against the exercise catalogue.
 * @param {{areas, skills, workouts, flows, assessments, programs}} input  parsed content
 * @param {Array<{id, variantOf?}>} exercises  the exercise catalogue (validate.mjs output)
 * @returns {{ content, problems: string[] }}
 */
export function checkContent(input, exercises) {
  const problems = []
  const say = (file, msg) => problems.push(`${file}: ${msg}`)
  // Only real exercises can be referenced; a female-drawing variant is a hidden duplicate.
  const exIds = new Set(exercises.filter(e => !e.variantOf).map(e => e.id))
  const content = {}
  for (const k of ['areas', ...TYPES]) content[k] = [...(input[k] || [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  // Walk every string in an object and flag em dashes (copy rule).
  const noEmDash = (file, obj) => {
    const walk = v => {
      if (typeof v === 'string') { if (v.includes(EM)) say(file, 'no em dash (—) in text, use a comma or a full stop') }
      else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(obj)
  }
  // Ids must be unique within a type (they become keys in the app and in user state).
  const uniq = (type, list) => {
    const seen = new Set()
    for (const x of list) {
      if (seen.has(x.id)) say(`catalogue/${type}/${x.id}.json`, `duplicate id "${x.id}"`)
      seen.add(x.id)
    }
  }
  const exRef = (file, where, id) => {
    if (!exIds.has(id)) say(file, `${where}: unknown exercise id "${id}"`)
  }

  // ---- areas ----
  const areaIds = new Set(content.areas.map(a => a.id))
  uniq('areas', content.areas)
  for (const a of content.areas) {
    const file = `catalogue/areas.json#${a.id}`
    if (!isText(a.id) || !isText(a.name)) say(file, 'an area needs an "id" and a "name"')
    if (!Array.isArray(a.muscles) || !a.muscles.length || a.muscles.some(m => !MUSCLES.includes(m)))
      say(file, `"muscles" must list body-map muscles: ${MUSCLES.join(', ')}`)
  }
  const areaList = (file, list) => {
    if (!Array.isArray(list) || !list.length || list.some(a => !areaIds.has(a))) say(file, `"areas" must list area ids: ${[...areaIds].join(', ')}`)
  }

  // A routine entry, the same shape routines[].ex[] use in the app (ExItem).
  const exItem = (file, where, it) => {
    if (!it || typeof it !== 'object') { say(file, `${where}: not an exercise entry`); return }
    exRef(file, where, it.id)
    if (!isPosInt(it.sets)) say(file, `${where}: "sets" must be a positive whole number`)
    if (it.mode === 'time') {
      if (!isPosInt(it.sec)) say(file, `${where}: a hold ("mode": "time") needs "sec" > 0`)
    } else {
      if (it.mode != null && it.mode !== 'reps') say(file, `${where}: "mode" must be "reps" or "time"`)
      if (!isPosInt(it.reps)) say(file, `${where}: needs "reps" > 0 (or "mode": "time" with "sec")`)
      if (it.repsMin != null && (!isPosInt(it.repsMin) || it.repsMin > it.reps)) say(file, `${where}: "repsMin" must be a whole number no higher than "reps"`)
    }
    if (it.side != null && typeof it.side !== 'boolean') say(file, `${where}: "side" must be true or false`)
  }

  // ---- skills ----
  uniq('skills', content.skills)
  for (const s of content.skills) {
    const file = `catalogue/skills/${s.id}.json`
    noEmDash(file, s)
    if (!isText(s.id) || !isText(s.name)) say(file, 'a skill needs an "id" and a "name"')
    if (!FAMILIES.includes(s.family)) say(file, `"family" must be one of: ${FAMILIES.join(', ')}`)
    if (!Array.isArray(s.steps) || !s.steps.length) { say(file, '"steps" must list at least one step'); continue }
    s.steps.forEach((st, i) => {
      const where = `steps[${i}]`
      exRef(file, where, st.exId)
      if (st.mode !== 'reps' && st.mode !== 'time') { say(file, `${where}: "mode" must be "reps" or "time"`); return }
      const unit = st.mode === 'time' ? 'sec' : 'reps'
      const t = st.target || {}, u = st.unlock || {}
      if (!isPosInt(t.sets) || !isPosInt(t[unit])) say(file, `${where}: "target" needs "sets" and "${unit}" > 0`)
      if (!isPosInt(u.sets) || !isPosInt(u[unit])) say(file, `${where}: "unlock" needs "sets" and "${unit}" > 0`)
      // The bar to move on is per set: an unlock below the prescribed reps/hold would "master" a
      // step by doing less than it asks. Sets may differ: practising 5 x 10 s and proving it with
      // 3 x 30 s (handstand) is a legitimate standard.
      else if (u[unit] < t[unit]) say(file, `${where}: "unlock" ${unit} must be at or above "target" (it is the bar to move on)`)
      if (!isPosInt(u.sessions)) say(file, `${where}: "unlock.sessions" must be a whole number of sessions >= 1`)
    })
  }
  const skillIds = new Set(content.skills.map(s => s.id))

  // ---- workouts ----
  uniq('workouts', content.workouts)
  for (const w of content.workouts) {
    const file = `catalogue/workouts/${w.id}.json`
    noEmDash(file, w)
    if (!isText(w.id) || !isText(w.name)) say(file, 'a workout needs an "id" and a "name"')
    if (!KINDS.includes(w.kind)) say(file, `"kind" must be one of: ${KINDS.join(', ')}`)
    else if (w.kind === 'muscle' ? !MUSCLE_GROUPS.includes(w.group) : !areaIds.has(w.group))
      say(file, `"group" must be ${w.kind === 'muscle' ? 'one of: ' + MUSCLE_GROUPS.join(', ') : 'an area id'}`)
    if (!LEVELS.includes(w.level)) say(file, `"level" must be one of: ${LEVELS.join(', ')}`)
    if (!GOALS.includes(w.goal)) say(file, `"goal" must be one of: ${GOALS.join(', ')}`)
    if (!isPosInt(w.minutes)) say(file, '"minutes" must be a positive whole number')
    if (!Array.isArray(w.ex) || !w.ex.length) say(file, '"ex" must list at least one exercise')
    else w.ex.forEach((it, i) => exItem(file, `ex[${i}]`, it))
  }

  // ---- flows ----
  uniq('flows', content.flows)
  for (const f of content.flows) {
    const file = `catalogue/flows/${f.id}.json`
    noEmDash(file, f)
    if (!isText(f.id) || !isText(f.name)) say(file, 'a flow needs an "id" and a "name"')
    areaList(file, f.areas)
    if (!LEVELS.includes(f.level)) say(file, `"level" must be one of: ${LEVELS.join(', ')}`)
    if (f.transitionSec != null && !(Number.isInteger(f.transitionSec) && f.transitionSec >= 0)) say(file, '"transitionSec" must be a whole number >= 0')
    if (!Array.isArray(f.items) || !f.items.length) { say(file, '"items" must list at least one hold'); continue }
    f.items.forEach((it, i) => {
      exRef(file, `items[${i}]`, it.exId)
      if (!isPosInt(it.sec)) say(file, `items[${i}]: "sec" must be > 0`)
      if (it.side != null && typeof it.side !== 'boolean') say(file, `items[${i}]: "side" must be true or false`)
    })
  }
  const flowIds = new Set(content.flows.map(f => f.id))

  // ---- assessments ----
  uniq('assessments', content.assessments)
  for (const a of content.assessments) {
    const file = `catalogue/assessments/${a.id}.json`
    noEmDash(file, a)
    if (!isText(a.id) || !isText(a.name)) say(file, 'a test needs an "id" and a "name"')
    if (!UNITS.includes(a.unit)) say(file, `"unit" must be one of: ${UNITS.join(', ')}`)
    if (!BETTER.includes(a.better)) say(file, `"better" must be one of: ${BETTER.join(', ')}`)
    if (typeof a.sided !== 'boolean') say(file, '"sided" must be true or false')
    if (!Array.isArray(a.range) || a.range.length !== 2 || !isNum(a.range[0]) || !isNum(a.range[1]) || a.range[0] >= a.range[1])
      say(file, '"range" must be [min, max] with min < max')
    areaList(file, a.areas)
    if (!Array.isArray(a.instructions) || a.instructions.length < 2 || a.instructions.some(s => !isText(s))) say(file, '"instructions" needs at least two steps')
    const b = a.bands
    if (!Array.isArray(b) || b.length < 2) { say(file, '"bands" needs at least two bands'); continue }
    b.forEach((band, i) => {
      if (!BAND_LABELS.includes(band.label)) say(file, `bands[${i}]: "label" must be one of: ${BAND_LABELS.join(', ')}`)
      const last = i === b.length - 1
      if (last && band.below != null) say(file, 'the last band is open-ended: drop its "below"')
      if (!last && !isNum(band.below)) say(file, `bands[${i}]: needs a numeric "below" (only the last band is open-ended)`)
      if (!last && i > 0 && isNum(band.below) && isNum(b[i - 1].below) && band.below <= b[i - 1].below)
        say(file, `bands[${i}]: "below" thresholds must ascend`)
    })
  }

  // ---- programs ----
  uniq('programs', content.programs)
  const weekday = d => Number.isInteger(d) && d >= 0 && d <= 6
  for (const p of content.programs) {
    const file = `catalogue/programs/${p.id}.json`
    noEmDash(file, p)
    if (!isText(p.id) || !isText(p.name)) say(file, 'a program needs an "id" and a "name"')
    if (!LEVELS.includes(p.level)) say(file, `"level" must be one of: ${LEVELS.join(', ')}`)
    if (!isPosInt(p.weeks)) say(file, '"weeks" must be a positive whole number')
    if (p.assessEveryWeeks != null && !isPosInt(p.assessEveryWeeks)) say(file, '"assessEveryWeeks" must be a positive whole number')
    const keys = new Set()
    if (!Array.isArray(p.routines) || !p.routines.length) say(file, '"routines" must list at least one routine')
    for (const r of p.routines || []) {
      const where = `routine "${r.key}"`
      if (!isText(r.key) || keys.has(r.key)) say(file, `${where}: needs a unique "key"`)
      keys.add(r.key)
      if (!isText(r.name)) say(file, `${where}: needs a "name"`)
      if (!Array.isArray(r.ex) || !r.ex.length) { say(file, `${where}: "ex" must list at least one exercise`); continue }
      r.ex.forEach((it, i) => exItem(file, `${where} ex[${i}]`, it))
      for (const [idx, skill] of Object.entries(r.ladders || {})) {
        const n = Number(idx)
        if (!Number.isInteger(n) || n < 0 || n >= r.ex.length) say(file, `${where}: ladder index ${idx} is not an entry of this routine`)
        if (!skillIds.has(skill)) say(file, `${where}: ladder "${skill}" is not a skill id`)
      }
    }
    for (const s of p.schedule || []) {
      if (!Array.isArray(s) || !weekday(s[0])) say(file, `schedule ${JSON.stringify(s)}: weekday must be 0 to 6`)
      else if (!keys.has(s[1])) say(file, `schedule ${JSON.stringify(s)}: names no routine of this program`)
    }
    for (const s of p.flows || []) {
      if (!Array.isArray(s) || !weekday(s[0])) say(file, `flows ${JSON.stringify(s)}: weekday must be 0 to 6`)
      else if (!flowIds.has(s[1])) say(file, `flows ${JSON.stringify(s)}: "${s[1]}" is not a flow id`)
    }
  }

  return { content, problems }
}

/** Read catalogue/areas.json and every catalogue/<type>/*.json into checkContent's input shape.
 *  A file whose name does not match its "id" is reported (ids are the file names, like exercises). */
export function loadContent(dir) {
  const problems = []
  const read = (file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (err) { problems.push(`${path.relative(path.dirname(dir), file)}: not valid JSON: ${err.message}`); return null }
  }
  const areasFile = path.join(dir, 'areas.json')
  const content = { areas: fs.existsSync(areasFile) ? (read(areasFile)?.areas || []) : [] }
  for (const t of TYPES) {
    const d = path.join(dir, t)
    content[t] = []
    if (!fs.existsSync(d)) continue
    for (const f of fs.readdirSync(d).filter(f => f.endsWith('.json')).sort()) {
      const x = read(path.join(d, f))
      if (!x) continue
      if (x.id !== f.slice(0, -5)) problems.push(`catalogue/${t}/${f}: "id" must be "${f.slice(0, -5)}"`)
      content[t].push(x)
    }
  }
  return { content, problems }
}

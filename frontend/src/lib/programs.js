// openBody built-in programs: multi-week plans (Fundamentals, the r/bodyweightfitness Recommended
// Routine, Skills & Strength, Mobility 30, Splits in 60, Hybrid), authored in catalogue/programs/
// and compiled to lib/content/programs.js. They replace openGym's barbell starter plans.
//
// Enrolling is deliberately boring: it turns the program into ORDINARY routines tagged
// `src: 'program:<id>:<key>'` and puts them on the program's weekdays of the weekly plan
// (S.week, the same structure the starter plans and the Plan screen use). So Home's "today", the
// workout screen, progression and history need nothing new. What enrolling never does:
//   · delete or edit a routine you had (only the program's own weekdays are reassigned, and the
//     caller asks first when one of those already holds a routine: takenDays);
//   · duplicate itself: enrolling again reuses the routines tagged with this program.
// The program's own state is just `S.program = { id, startedAt }` (absent/null = none); its week,
// adherence and today's flow are derived from that and the log.
// Pure functions; `enroll`/`leaveProgram` mutate the draft they are given (call them inside a
// store update), like applyLadders.
import PROGRAM_LIST from './content/programs.js'
import { defaultPolicy } from './workouts.js'
import { onCurrentStep } from './ladder.js'
import { uid } from './format.js'

export const PROGRAMS = PROGRAM_LIST
const BY_ID = Object.fromEntries(PROGRAMS.map(p => [p.id, p]))
export const programById = id => BY_ID[id] || null
export const PROGRAM_SRC = 'program:'
const srcOf = (program, key) => PROGRAM_SRC + program.id + ':' + key

/**
 * The program as new routines plus its schedule, not yet in state. Laddered entries (the
 * program's `ladders` map) are tagged with their skill and put on the skill's CURRENT step for
 * this person (lib/ladder.js onCurrentStep): never below where the log says you are, and never
 * above it either, whatever exercise the program's content wrote in that slot.
 */
export function buildProgram(S, program, newId = uid) {
  const idOf = {}
  const routines = program.routines.map(r => {
    const id = newId()
    idOf[r.key] = id
    const ex = r.ex.map((e, i) => {
      const entry = { ...e, weight: 0, prog: e.prog || defaultPolicy(e) }
      const skill = r.ladders?.[i] ?? r.ladders?.[String(i)]
      return skill ? onCurrentStep(S, { ...entry, ladder: skill }) : entry
    })
    return { id, name: r.name, emoji: r.emoji, src: srcOf(program, r.key), ex }
  })
  return {
    routines,
    schedule: program.schedule.map(([day, key]) => ({ day, routineId: idOf[key] }))
  }
}

/** The program's weekdays that already hold one of your existing routines (ask before replacing). */
export function takenDays(S, program) {
  const have = new Set((S?.routines || []).map(r => r.id))
  const days = [...new Set(program.schedule.map(([d]) => d))].sort()
  return days.filter(d => [].concat(S?.week?.[d] || []).some(id => have.has(id)))
}

/** Enroll into `program` on draft state `S`. Options: today (ISO date), newId (id factory). */
export function enroll(S, program, { today, newId = uid } = {}) {
  S.routines = S.routines || []
  S.week = S.week || {}
  const built = buildProgram(S, program, newId)
  // reuse the routines a previous enrollment in this program created
  const idMap = {}
  built.routines.forEach(r => {
    const have = S.routines.find(x => x.src === r.src)
    if (have) idMap[r.id] = have.id
    else { S.routines.push(r); idMap[r.id] = r.id }
  })
  // Switching programs: the previous program's routines come off the weekdays this one does not
  // use, so its sessions stop appearing as "today". The routines themselves stay (yours now).
  const ownSrc = PROGRAM_SRC + program.id + ':'
  const otherProgram = new Set(S.routines.filter(r => typeof r.src === 'string' && r.src.startsWith(PROGRAM_SRC) && !r.src.startsWith(ownSrc)).map(r => r.id))
  if (otherProgram.size) for (const d of Object.keys(S.week)) {
    const left = [].concat(S.week[d] || []).filter(id => !otherProgram.has(id))
    if (left.length) S.week[d] = left; else delete S.week[d]
  }
  built.schedule.forEach(({ day, routineId }) => { S.week[day] = [idMap[routineId]] })
  S.program = { id: program.id, startedAt: today }
  return S
}

/** Stop following the program. Its routines and weekly plan stay; you own them now. */
export function leaveProgram(S) { S.program = null; return S }

// Calendar helpers on ISO dates, at local noon so a DST change never shifts a day.
const dayMs = 86400000
const at = iso => new Date(iso + 'T12:00:00').getTime()
const isoOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const weekdayOf = iso => new Date(iso + 'T12:00:00').getDay()

/**
 * Whole calendar days from one local-noon timestamp to another. Rounded, not floored: across a
 * daylight-saving change noon-to-noon is 23 or 25 hours, and flooring 23 h read a whole week as
 * six days (code review, 2026-10-13: program week off by one around the spring change).
 */
export const daysBetween = (fromMs, toMs) => Math.round((toMs - fromMs) / dayMs)

/** `{ week, weeks, done }`: the program week `today` falls in (1-based, capped), done after the end. */
export function programWeek(S, program, today) {
  const days = daysBetween(at(S.program.startedAt), at(today))
  const week = Math.floor(Math.max(0, days) / 7) + 1
  return { week: Math.min(week, program.weeks), weeks: program.weeks, done: week > program.weeks }
}

/** The guided flow the program schedules on `today`'s weekday, or null. */
export function todaysFlow(program, today) {
  const wd = weekdayOf(today)
  const hit = (program.flows || []).find(([d]) => d === wd)
  return hit ? hit[1] : null
}

/**
 * Adherence since the start, up to the day before `today`: `{ done, planned }`. A scheduled
 * routine day counts when any non-flow workout was logged that day; a scheduled flow day when a
 * flow was. (Day-level, not routine-level: doing B on A's day still shows up as training.)
 */
export function adherence(S, program, today) {
  if (!S?.program) return { done: 0, planned: 0 }
  const routineDays = new Set(program.schedule.map(([d]) => d))
  const flowDays = new Set((program.flows || []).map(([d]) => d))
  const logged = new Map()
  for (const w of S.workouts || []) {
    const k = logged.get(w.d) || { routine: false, flow: false }
    if (w.flow) k.flow = true; else k.routine = true
    logged.set(w.d, k)
  }
  let done = 0, planned = 0
  for (let t = at(S.program.startedAt); t < at(today); t += dayMs) {
    const d = isoOf(t), wd = weekdayOf(d), k = logged.get(d)
    if (routineDays.has(wd)) { planned++; if (k?.routine) done++ }
    if (flowDays.has(wd)) { planned++; if (k?.flow) done++ }
  }
  return { done, planned }
}

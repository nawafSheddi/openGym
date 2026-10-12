// Tests for openBody's content validator (validate-content.mjs): skill ladders, workouts, guided
// flows, flexibility assessments, programs and the area taxonomy.
// Run: node --test scripts/catalogue/validate-content.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { checkContent } from './validate-content.mjs'

// A tiny exercise catalogue: two real exercises and one female-drawing variant (not usable).
const EX = [
  { id: '0001', name: 'pull-up' },
  { id: '0002', name: 'plank' },
  { id: '0003', name: 'pull-up', variantOf: '0001' }
]

// The smallest valid content set; each test breaks exactly one thing in a copy of it.
const valid = () => ({
  areas: [{ id: 'core', name: 'Core', muscles: ['abs'] }, { id: 'hips', name: 'Hips', muscles: ['gluteal'] }],
  skills: [{ id: 'front-lever', name: 'Front lever', family: 'pull', description: 'Hold.',
    steps: [
      { exId: '0001', label: 'Pull-up', mode: 'reps', target: { sets: 3, reps: 5 }, unlock: { sets: 3, reps: 8, sessions: 2 } },
      { exId: '0002', label: 'Plank', mode: 'time', target: { sets: 3, sec: 10 }, unlock: { sets: 3, sec: 15, sessions: 2 } }
    ] }],
  workouts: [{ id: 'core-beginner', name: 'Core', kind: 'muscle', group: 'core', level: 'beginner', goal: 'strength', minutes: 15, description: 'Core.',
    ex: [{ id: '0002', sets: 3, mode: 'time', sec: 30 }, { id: '0001', sets: 3, reps: 8, repsMin: 5 }] }],
  flows: [{ id: 'hip-opener', name: 'Hip opener', description: 'Open.', areas: ['hips'], level: 'beginner', transitionSec: 5,
    items: [{ exId: '0002', sec: 45, side: true, cue: 'Breathe.' }] }],
  assessments: [{ id: 'toe-touch', name: 'Toe touch', unit: 'cm', better: 'higher', sided: false, range: [-40, 40], areas: ['core'],
    instructions: ['Stand.', 'Reach.'],
    bands: [{ label: 'poor', below: -10 }, { label: 'fair', below: 0 }, { label: 'good', below: 10 }, { label: 'great', below: 20 }, { label: 'elite' }] }],
  programs: [{ id: 'fundamentals', name: 'Fundamentals', level: 'beginner', weeks: 8, description: 'Start.', assessEveryWeeks: 4,
    routines: [{ key: 'a', name: 'A', emoji: 'pullup', ex: [{ id: '0001', sets: 3, reps: 5 }], ladders: { 0: 'front-lever' } }],
    schedule: [[1, 'a'], [3, 'a']], flows: [[2, 'hip-opener']] }]
})

const problems = c => checkContent(c, EX).problems
const has = (c, re) => assert.ok(problems(c).some(p => re.test(p)), `expected a problem matching ${re}, got:\n${problems(c).join('\n')}`)

describe('checkContent', () => {
  test('accepts a valid content set and returns it sorted', () => {
    const { problems: p, content } = checkContent(valid(), EX)
    assert.deepEqual(p, [])
    assert.equal(content.skills[0].id, 'front-lever')
  })

  test('rejects an exercise id that does not exist, in every content type', () => {
    const c = valid()
    c.skills[0].steps[0].exId = '9999'
    c.workouts[0].ex[0].id = '9998'
    c.flows[0].items[0].exId = '9997'
    c.programs[0].routines[0].ex[0].id = '9996'
    const p = problems(c)
    for (const id of ['9999', '9998', '9997', '9996']) assert.ok(p.some(x => x.includes(id)), `missing ${id}`)
  })

  test('rejects a female-drawing variant as an exercise reference', () => {
    const c = valid(); c.workouts[0].ex[1].id = '0003'
    has(c, /0003/)
  })

  test('rejects bad enums', () => {
    let c = valid(); c.skills[0].family = 'arms'; has(c, /family/)
    c = valid(); c.workouts[0].level = 'expert'; has(c, /level/)
    c = valid(); c.workouts[0].kind = 'zone'; has(c, /kind/)
    c = valid(); c.assessments[0].unit = 'inch'; has(c, /unit/)
    c = valid(); c.flows[0].areas = ['elbows']; has(c, /area/)
  })

  test('rejects a workout group that does not fit its kind', () => {
    const c = valid(); c.workouts[0].group = 'hips'   // an area id on a muscle workout
    has(c, /group/)
  })

  test('a skill step needs reps for reps mode and sec for time mode, and an unlock at or above its target', () => {
    let c = valid(); delete c.skills[0].steps[1].target.sec; has(c, /target/)
    c = valid(); c.skills[0].steps[0].unlock.reps = 3; has(c, /unlock/)
    c = valid(); c.skills[0].steps[0].unlock.sessions = 0; has(c, /sessions/)
    c = valid(); c.skills[0].steps = []; has(c, /steps/)
  })

  test('assessment bands must ascend with only the last one open', () => {
    let c = valid(); c.assessments[0].bands[2].below = -20; has(c, /ascend/)
    c = valid(); delete c.assessments[0].bands[1].below; has(c, /below/)
    c = valid(); c.assessments[0].bands[4].below = 99; has(c, /last band/)
    c = valid(); c.assessments[0].range = [10, 0]; has(c, /range/)
  })

  test('program schedules name real routines and flows on real weekdays; ladders point at real skills and entries', () => {
    let c = valid(); c.programs[0].schedule.push([4, 'nope']); has(c, /schedule/)
    c = valid(); c.programs[0].schedule.push([7, 'a']); has(c, /weekday/)
    c = valid(); c.programs[0].flows.push([5, 'no-flow']); has(c, /flow/)
    c = valid(); c.programs[0].routines[0].ladders = { 0: 'no-skill' }; has(c, /ladder/)
    c = valid(); c.programs[0].routines[0].ladders = { 4: 'front-lever' }; has(c, /ladder/)
  })

  test('rejects duplicate ids and em dashes in text', () => {
    let c = valid(); c.flows.push({ ...c.flows[0] }); has(c, /duplicate/)
    c = valid(); c.workouts[0].description = 'Core — hard.'; has(c, /em dash/)
  })

  test('rejects a repsMin above reps and a hold without seconds', () => {
    let c = valid(); c.workouts[0].ex[1].repsMin = 12; has(c, /repsMin/)
    c = valid(); delete c.workouts[0].ex[0].sec; has(c, /sec/)
  })

  test('area muscles must be body-map muscles', () => {
    const c = valid(); c.areas[0].muscles = ['six-pack']; has(c, /muscle/)
  })
})

// openBody flexibility assessments (lib/assessments.js): benchmark bands, results over time,
// the mobility map, when the next test day is due, and cm/in display.
import { describe, it, expect } from 'vitest'
import {
  ASSESSMENTS, assessmentById, BAND_ORDER, bandOf, inRange, resultsFor, latest, trend,
  testRank, areaRanks, mobilityLoad, lastTestDate, isDue, improved, toDisplay, fromDisplay, displayUnit
} from './assessments.js'

// A higher-is-better test in cm and a lower-is-better sided test.
const TOE = { id: 'toe', name: 'Toe touch', unit: 'cm', better: 'higher', sided: false, range: [-40, 40], areas: ['hamstrings'],
  bands: [{ label: 'poor', below: -10 }, { label: 'fair', below: 0 }, { label: 'good', below: 10 }, { label: 'great', below: 20 }, { label: 'elite' }] }
const SPLIT = { id: 'split', name: 'Front split', unit: 'cm', better: 'lower', sided: true, range: [0, 100], areas: ['hamstrings', 'hip-flexors-quads'],
  bands: [{ label: 'elite', below: 2 }, { label: 'great', below: 8 }, { label: 'good', below: 15 }, { label: 'fair', below: 25 }, { label: 'poor' }] }
const R = (testId, d, value, side) => ({ id: testId + d + (side || ''), testId, d, value, ...(side ? { side } : {}) })

describe('catalogue tests', () => {
  it('ships the 11 tests', () => {
    expect(ASSESSMENTS).toHaveLength(11)
    expect(assessmentById('toe-touch')?.unit).toBe('cm')
    expect(assessmentById('nope')).toBe(null)
  })
})

describe('bandOf / inRange', () => {
  it('finds the band by ascending thresholds, last band open', () => {
    expect(bandOf(TOE, -20)).toEqual({ label: 'poor', rank: 0 })
    expect(bandOf(TOE, -10)).toEqual({ label: 'fair', rank: 1 })   // a threshold belongs to the band above
    expect(bandOf(TOE, 5)).toEqual({ label: 'good', rank: 2 })
    expect(bandOf(TOE, 35)).toEqual({ label: 'elite', rank: 4 })
  })
  it('ranks by label, so a lower-is-better test still ranks elite highest', () => {
    expect(bandOf(SPLIT, 0)).toEqual({ label: 'elite', rank: 4 })
    expect(bandOf(SPLIT, 40)).toEqual({ label: 'poor', rank: 0 })
    expect(BAND_ORDER).toEqual(['poor', 'fair', 'good', 'great', 'elite'])
  })
  it('checks values against the test range', () => {
    expect(inRange(TOE, 0)).toBe(true)
    expect(inRange(TOE, 41)).toBe(false)
    expect(inRange(TOE, NaN)).toBe(false)
    expect(inRange(TOE, '5')).toBe(false)
  })
})

describe('results', () => {
  const S = { assessments: [R('toe', '2026-09-01', -5), R('toe', '2026-10-01', 3), R('split', '2026-10-01', 30, 'L'), R('split', '2026-10-01', 12, 'R'), R('split', '2026-09-01', 40, 'L')] }

  it('lists a test’s results oldest first, per side when asked', () => {
    expect(resultsFor(S, 'toe').map(r => r.value)).toEqual([-5, 3])
    expect(resultsFor(S, 'split', 'L').map(r => r.value)).toEqual([40, 30])
  })
  it('latest gives the newest value, or per side for a sided test', () => {
    expect(latest(S, TOE)).toEqual({ value: 3, d: '2026-10-01' })
    expect(latest(S, SPLIT)).toEqual({ L: { value: 30, d: '2026-10-01' }, R: { value: 12, d: '2026-10-01' } })
    expect(latest({}, TOE)).toBe(null)
  })
  it('trend gives chart points', () => {
    const pts = trend(S, 'toe')
    expect(pts.map(p => p.y)).toEqual([-5, 3])
    expect(pts[0]).toMatchObject({ d: '2026-09-01', t: expect.any(Number) })
  })
  it('a sided test ranks by its weaker side', () => {
    expect(testRank(S, SPLIT)).toBe(0)        // L 30 cm = poor, R 12 = good: poor
    expect(testRank(S, TOE)).toBe(2)          // 3 cm = good
    expect(testRank({ assessments: [] }, TOE)).toBe(null)
  })
  it('improved respects the test direction', () => {
    expect(improved(TOE, -5, 3)).toBe(true)
    expect(improved(SPLIT, 30, 25)).toBe(true)
    expect(improved(SPLIT, 25, 30)).toBe(false)
  })
})

describe('mobility map', () => {
  const tests = [TOE, SPLIT]
  const S = { assessments: [R('toe', '2026-10-01', 15), R('split', '2026-10-01', 1, 'L'), R('split', '2026-10-01', 1, 'R')] }
  it('averages the ranks of the tests in each area', () => {
    // hamstrings: toe great (3) and split elite (4) → 3.5; hip flexors: split only → 4
    expect(areaRanks(S, tests)).toEqual({ hamstrings: 3.5, 'hip-flexors-quads': 4 })
  })
  it('turns area ranks into body-map load (rank + 1, untested muscles absent)', () => {
    const load = mobilityLoad(S, tests)
    expect(load.hamstring).toBe(4.5)
    expect(load['hip-flexors']).toBe(5)
    expect(load.quadriceps).toBe(5)
    expect(load.chest).toBeUndefined()
  })
})

describe('test day due', () => {
  it('is due with no results, and again after the interval', () => {
    const now = new Date('2026-10-13T12:00:00').getTime()
    expect(isDue({ assessments: [] }, now)).toBe(true)
    expect(lastTestDate({ assessments: [R('toe', '2026-10-01', 1), R('toe', '2026-09-01', 0)] })).toBe('2026-10-01')
    expect(isDue({ assessments: [R('toe', '2026-10-01', 1)] }, now)).toBe(false)
    expect(isDue({ assessments: [R('toe', '2026-09-01', 1)] }, now)).toBe(true)     // 42 days
    expect(isDue({ assessments: [R('toe', '2026-10-01', 1)] }, now, 7)).toBe(true)   // weekly
  })
})

describe('units', () => {
  it('shows cm as inches for an imperial profile and reads them back as cm', () => {
    expect(displayUnit(TOE, 'lb')).toBe('in')
    expect(displayUnit(TOE, 'kg')).toBe('cm')
    expect(toDisplay(TOE, 25.4, 'lb')).toBe(10)
    expect(fromDisplay(TOE, 10, 'lb')).toBeCloseTo(25.4)
    expect(toDisplay(TOE, 12, 'kg')).toBe(12)
  })
  it('leaves degrees and seconds alone', () => {
    const deg = { ...TOE, unit: 'deg' }
    expect(displayUnit(deg, 'lb')).toBe('deg')
    expect(toDisplay(deg, 90, 'lb')).toBe(90)
    expect(fromDisplay(deg, 90, 'lb')).toBe(90)
  })
})

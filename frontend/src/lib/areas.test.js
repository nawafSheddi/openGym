// openBody's mobility areas (lib/areas.js): which body area an exercise works or stretches.
// The library's Area filter, the Workouts "by area" groups and the mobility map all read this.
import { describe, it, expect } from 'vitest'
import { AREAS, AREA_IDS, areaById, areasOf, inArea, isMobilityEx, areaFilterOptions } from './areas.js'

// Minimal catalogue rows (EXDB shape): n name, bp body part, tg target, mg/sm helpers, cat category.
const ex = (o) => ({ id: 'x', n: 'thing', bp: 'waist', tg: 'abs', mg: '', sm: [], cat: 'strength', ...o })

describe('area taxonomy', () => {
  it('loads the 11 areas from the catalogue content', () => {
    expect(AREA_IDS).toEqual(['calves-ankles', 'core', 'groin', 'hamstrings', 'hip-flexors-quads', 'hips', 'lower-back', 'neck', 'shoulders', 'thoracic', 'wrists-forearms'])
    expect(areaById('hips').name).toBe('Hips & glutes')
    expect(areaById('nope')).toBe(null)
    expect(AREAS.every(a => a.muscles.length > 0)).toBe(true)
  })
})

describe('areasOf', () => {
  it('maps an exercise to areas through its main muscles', () => {
    expect(areasOf(ex({ n: 'seated hamstring stretch', bp: 'upper legs', tg: 'hamstrings', cat: 'stretching' }))).toContain('hamstrings')
    expect(areasOf(ex({ n: 'plank', tg: 'abs' }))).toContain('core')
    expect(areasOf(ex({ n: 'pigeon pose', bp: 'upper legs', tg: 'glutes', cat: 'yoga' }))).toContain('hips')
  })

  it('does not count helper muscles, so a squat is not a groin exercise', () => {
    const squat = ex({ n: 'squat', bp: 'upper legs', tg: 'quads', sm: ['glutes', 'adductors'] })
    expect(areasOf(squat)).not.toContain('groin')
    expect(areasOf(squat)).toContain('hip-flexors-quads')
  })

  it('tags the neck only for neck work, not every trapezius exercise', () => {
    expect(areasOf(ex({ n: 'barbell shrug', bp: 'back', tg: 'traps' }))).not.toContain('neck')
    expect(areasOf(ex({ n: 'neck side stretch', bp: 'neck', tg: 'levator scapulae', cat: 'stretching' }))).toEqual(['neck'])
  })

  it('tags wrist and forearm work by muscle or by name', () => {
    expect(areasOf(ex({ n: 'kneeling wrist rocks', bp: 'lower arms', tg: 'forearms', cat: 'mobility' }))).toContain('wrists-forearms')
    expect(areasOf(ex({ n: 'wrist circles', bp: 'lower arms', tg: 'delts', cat: 'mobility' }))).toContain('wrists-forearms')
  })

  it('tags thoracic and ankle work by name too', () => {
    expect(areasOf(ex({ n: 'thoracic rotation', bp: 'back', tg: 'spine', cat: 'mobility' }))).toContain('thoracic')
    expect(areasOf(ex({ n: 'ankle circles', bp: 'lower legs', tg: 'calves', cat: 'mobility' }))).toContain('calves-ankles')
  })

  it('files chest and arm stretches under shoulders (shoulder-girdle openers), but not chest strength work', () => {
    expect(areasOf(ex({ n: 'doorway chest stretch', bp: 'chest', tg: 'pectorals', cat: 'stretching' }))).toContain('shoulders')
    expect(areasOf(ex({ n: 'biceps stretch behind the back', bp: 'upper arms', tg: 'biceps', cat: 'stretching' }))).toContain('shoulders')
    expect(areasOf(ex({ n: 'push-up', bp: 'chest', tg: 'pectorals', cat: 'calisthenics' }))).not.toContain('shoulders')
  })

  it('returns an empty list for nothing recognisable, and never throws on junk', () => {
    expect(areasOf(null)).toEqual([])
    expect(areasOf({})).toEqual(expect.any(Array))
  })
})

describe('inArea / isMobilityEx / areaFilterOptions', () => {
  const ham = ex({ id: 'h', n: 'hamstring stretch', bp: 'upper legs', tg: 'hamstrings', cat: 'stretching' })
  const plank = ex({ id: 'p', n: 'plank', tg: 'abs', cat: 'isometric' })

  it('inArea is areasOf membership', () => {
    expect(inArea(ham, 'hamstrings')).toBe(true)
    expect(inArea(ham, 'core')).toBe(false)
  })

  it('isMobilityEx covers mobility, stretching, yoga and rehab', () => {
    expect(isMobilityEx(ham)).toBe(true)
    expect(isMobilityEx(plank)).toBe(false)
    expect(isMobilityEx(ex({ cat: 'yoga' }))).toBe(true)
  })

  it('offers only areas present in the list, in taxonomy order', () => {
    expect(areaFilterOptions([ham, plank])).toEqual(['core', 'hamstrings'])
    expect(areaFilterOptions([])).toEqual([])
  })
})

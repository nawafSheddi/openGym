// openBody's built-in "Calisthenics" equipment profile (lib/equipment.js): what it lets through
// and what it hides. It is how openBody keeps the gym world out of sight by default without
// deleting a single exercise. "Show all equipment" in the library still reaches everything.
import { describe, it, expect } from 'vitest'
import { caliProfile, eqAvailable, CALI_EQUIPMENT, CALI_PROFILE_ID, ACC_V, ALL_EQUIPMENT } from './equipment.js'

describe('calisthenics profile', () => {
  const p = caliProfile('Calisthenics')

  it('has the fixed id, the given name and the current accessory version', () => {
    expect(p.id).toBe(CALI_PROFILE_ID)
    expect(p.name).toBe('Calisthenics')
    expect(p.accV).toBe(ACC_V)
    expect(p.equipment).toEqual(CALI_EQUIPMENT)
  })

  it('returns a fresh equipment array (editing a profile never mutates the constant)', () => {
    caliProfile('x').equipment.push('barbell')
    expect(CALI_EQUIPMENT).not.toContain('barbell')
  })

  it('only lists equipment the catalogue and checklist know', () => {
    for (const eq of CALI_EQUIPMENT) expect(ALL_EQUIPMENT).toContain(eq)
  })

  it('allows bodyweight, bar work, rings/suspension, bands and weighted calisthenics', () => {
    expect(eqAvailable(p.equipment, { n: 'push-up', eq: 'body weight' })).toBe(true)
    expect(eqAvailable(p.equipment, { n: 'pull-up', eq: 'body weight' })).toBe(true)   // needs the bar accessory
    expect(eqAvailable(p.equipment, { n: 'weighted dip', eq: 'weighted' })).toBe(true)
    expect(eqAvailable(p.equipment, { n: 'ring row', eq: 'suspension trainer' })).toBe(true)
    expect(eqAvailable(p.equipment, { n: 'band pull apart', eq: 'band' })).toBe(true)
    expect(eqAvailable(p.equipment, { n: 'foam roll quads', eq: 'roller' })).toBe(true)
  })

  it('hides barbell, dumbbell, cable and machine work', () => {
    expect(eqAvailable(p.equipment, { n: 'barbell bench press', eq: 'barbell' })).toBe(false)
    expect(eqAvailable(p.equipment, { n: 'dumbbell curl', eq: 'dumbbell' })).toBe(false)
    expect(eqAvailable(p.equipment, { n: 'cable crossover', eq: 'cable' })).toBe(false)
    expect(eqAvailable(p.equipment, { n: 'lever chest press', eq: 'leverage machine' })).toBe(false)
    expect(eqAvailable(p.equipment, { n: 'smith squat', eq: 'smith machine' })).toBe(false)
  })
})

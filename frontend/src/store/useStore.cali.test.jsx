// @vitest-environment happy-dom
// openBody: a profile created from nothing starts with the built-in "Calisthenics" equipment
// profile active, so the library opens on bodyweight work instead of 5,000 gym exercises.
// A profile that already exists (an openGym state or backup brought over) is NOT changed under
// its owner: DEF keeps the old defaults, the same split weigh-in and animation size use.
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { freshState, DEF, restoredStateFor, restartedState } from './useStore.js'
import { CALI_PROFILE_ID, CALI_EQUIPMENT, activeProfile } from '../lib/equipment.js'

const empty = () => ({ workouts: [], routines: [], bodyweight: [], customEx: [] })

describe('calisthenics profile default', () => {
  it('a fresh profile has the Calisthenics profile, active and filtering', () => {
    const S = freshState()
    expect(S.equipFilterOn).toBe(true)
    expect(S.activeEquipId).toBe(CALI_PROFILE_ID)
    expect(S.equipProfiles.map(p => p.id)).toEqual([CALI_PROFILE_ID])
    expect(activeProfile(S).equipment).toEqual(CALI_EQUIPMENT)
  })

  it('a fresh profile hides the gym check-in card; DEF keeps it for existing profiles', () => {
    expect(freshState().checkIn).toBe(false)
    expect(DEF.checkIn).toBe(true)
  })

  it('every fresh state gets its own copy (no shared array between profiles)', () => {
    const a = freshState(), b = freshState()
    a.equipProfiles[0].equipment.push('barbell')
    expect(b.equipProfiles[0].equipment).not.toContain('barbell')
  })

  it('a restart (Reset everything / another account) also starts on Calisthenics', () => {
    expect(restartedState({ lang: 'de' }).activeEquipId).toBe(CALI_PROFILE_ID)
  })

  it('DEF keeps filtering off with no profiles, so an existing state is not changed', () => {
    expect(DEF.equipFilterOn).toBe(false)
    expect(DEF.equipProfiles).toEqual([])
    expect(DEF.activeEquipId).toBe(null)
  })

  it('an openGym state with its own profile keeps that profile active and gets no cali profile injected', () => {
    const home = { id: 'home', name: 'Home', equipment: ['dumbbell'], accV: 1 }
    const S = restoredStateFor(empty(), { workouts: [{ id: 'w1' }], equipProfiles: [home], activeEquipId: 'home', equipFilterOn: true })
    expect(S.activeEquipId).toBe('home')
    expect(S.equipProfiles.map(p => p.id)).toEqual(['home'])
  })

  it('an openGym state from before equipment profiles (no keys) loads without crashing, unfiltered', () => {
    const S = restoredStateFor(empty(), { workouts: [{ id: 'w1' }], routines: [] })
    expect(S.equipFilterOn).toBeFalsy()
    expect(activeProfile(S)).toBe(null)
  })
})

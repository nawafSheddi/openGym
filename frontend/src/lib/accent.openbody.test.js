// openBody's brand accent: the teal preset, retuned, is the default for new profiles.
// The palette must stay readable: accent vs the page/card fills (3:1, WCAG large text and
// controls) and the label colour drawn on a filled accent button (ACCENT_INK).
import { describe, it, expect } from 'vitest'
import { DEFAULT_ACCENT, accentKey, contrast, accentPair } from './accent.js'
import { ACCENTS, ACCENT_INK } from './format.js'

describe('openBody accent', () => {
  it('defaults to the teal preset', () => {
    expect(DEFAULT_ACCENT).toBe('teal')
    // an unknown or missing stored key falls back to the brand accent, not green
    expect(accentKey({})).toBe('teal')
    expect(accentKey({ accent: 'not-a-preset' })).toBe('teal')
  })

  it('uses the brand teal shade', () => {
    expect(ACCENTS.teal).toBe('#2dd4bf')
  })

  it('stands out from the dark theme fills and carries readable ink', () => {
    for (const bg of ['#000000', '#1c1c1e']) expect(contrast(ACCENTS.teal, bg)).toBeGreaterThanOrEqual(3)
    expect(contrast(ACCENTS.teal, ACCENT_INK.teal)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps a stored green choice (existing users are not recoloured)', () => {
    expect(accentKey({ accent: 'lime' })).toBe('lime')
    expect(accentPair('lime').accent).toBe(ACCENTS.lime)
  })
})

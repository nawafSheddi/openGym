// A result field for one test (or one side of it): the number in the unit the profile reads
// (cm or in, degrees, seconds), with a ± toggle for tests whose range goes below zero
// (toe touch: fingertips short of the toes are negative). The ± is a button, not a typed minus,
// because the iOS decimal keypad has no minus key; the shared NumberField stays unsigned.
import { useState } from 'react'
import { t } from '../../lib/i18n.js'
import { NumberField } from '../../components/ui.jsx'
import { displayUnit, toDisplay, fromDisplay } from '../../lib/assessments.js'
import { unitLabel } from './labels.js'

export default function ResultInput({ test, unit, value, onChange, label }) {
  const signed = test.range[0] < 0
  const shown = value == null ? null : toDisplay(test, value, unit)
  // The sign lives in the value once there is one; before that (± tapped first), in local state.
  const [negPref, setNegPref] = useState(false)
  const neg = shown != null && shown !== 0 ? shown < 0 : negPref
  const set = (magnitude, negative) => {
    setNegPref(negative)
    onChange(magnitude == null ? null : fromDisplay(test, negative ? -magnitude : magnitude, unit))
  }
  return (
    <label className="as-input">
      {label && <span className="as-input-label">{label}</span>}
      {signed && <button type="button" className={'chip nocap as-sign' + (neg ? ' on' : '')} aria-pressed={neg}
        aria-label={t('Below zero')} onClick={() => set(shown == null ? null : Math.abs(shown), !neg)}>±</button>}
      {/* the minus sits in front of the number it belongs to */}
      {neg && <span className="as-minus" aria-hidden="true">−</span>}
      <NumberField nullable value={shown == null ? null : Math.abs(shown)} onChange={n => set(n, neg)} />
      <span className="as-unit">{unitLabel(displayUnit(test, unit))}</span>
    </label>
  )
}

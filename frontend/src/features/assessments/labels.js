// Display labels for flexibility tests. Literal t() calls so check-source-strings.mjs finds them.
import { t } from '../../lib/i18n.js'

/** Band label shown on chips: Poor … Elite. */
export function bandLabel(label) {
  switch (label) {
    case 'poor': return t('Poor')
    case 'fair': return t('Fair')
    case 'good': return t('Good')
    case 'great': return t('Great')
    case 'elite': return t('Elite')
    default: return label
  }
}

/** Unit abbreviation for a result. */
export function unitLabel(u) {
  if (u === 'cm') return t('cm')
  if (u === 'in') return t('in')
  if (u === 'deg') return '°'
  if (u === 's') return t('s')
  return u
}

/** A stored value as text in the display unit: "12 cm", "4.7 in", "165°", "90 s". */
export const valueText = (v, u) => (u === 'deg' ? `${v}°` : `${v} ${unitLabel(u)}`)

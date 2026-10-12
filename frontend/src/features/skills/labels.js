// Display labels for the skills screens. Literal t() calls so check-source-strings.mjs finds them.
import { t } from '../../lib/i18n.js'

/** Section title for a skill family id. */
export function familyLabel(f) {
  switch (f) {
    case 'push': return t('Push')
    case 'pull': return t('Pull')
    case 'legs': return t('Legs')
    case 'core': return t('Core')
    case 'balance': return t('Balance')
    default: return f
  }
}

/** "Step 2 of 6" */
export const stepCountLabel = (n, total) => t('Step {0} of {1}', n, total)

/** "3 × 15 s" or "3 × 12" for a step's target or unlock bar. */
export function barLabel(mode, bar) {
  return mode === 'time' ? `${bar.sets} × ${t('{0} s', bar.sec)}` : `${bar.sets} × ${bar.reps}`
}

/** A single best set: "22 s" or "12 reps". */
export const bestLabel = (mode, v) => (mode === 'time' ? t('{0} s', v) : t('{0} reps', v))

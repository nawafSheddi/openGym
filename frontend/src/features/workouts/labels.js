// Display labels for workout levels, muscle groups and durations. Each label is a literal t()
// call (check-source-strings.mjs extracts them statically), mapped from the content's ids.
import { t } from '../../lib/i18n.js'

/** "Beginner" / "Intermediate" / "Advanced" for a level id. */
export function levelLabel(level) {
  if (level === 'beginner') return t('Beginner')
  if (level === 'intermediate') return t('Intermediate')
  if (level === 'advanced') return t('Advanced')
  return level
}

/** Section title for a muscle-group id (workouts by muscle). */
export function groupLabel(group) {
  switch (group) {
    case 'chest': return t('Chest')
    case 'back': return t('Back')
    case 'shoulders': return t('Shoulders')
    case 'arms': return t('Arms')
    case 'core': return t('Core')
    case 'legs': return t('Legs')
    case 'full-body': return t('Full body')
    default: return group
  }
}

/** "25 min" */
export const minutesLabel = n => t('{0} min', n)

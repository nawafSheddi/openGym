// The "Explore" section switcher: one chip row on top of every Explore screen (Exercises,
// Workouts, and the skill / mobility / test screens as they land), so the bottom tab bar keeps
// its five tabs and all the browsing lives behind one of them.
//
// Sections are config, not markup: add an entry to DISCOVER_SECTIONS and its route in App.jsx,
// and it appears here everywhere. Labels are literal t() calls inside `label` so
// check-source-strings.mjs finds them.
import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import Icon from '../../components/Icon.jsx'
import './discover.css'

export const DISCOVER_SECTIONS = [
  { path: '/library', icon: 'dumbbell', label: () => t('Exercises') },
  { path: '/workouts', icon: 'list', label: () => t('Workouts') },
  { path: '/skills', icon: 'logo', label: () => t('Skills') },
  { path: '/flows', icon: 'stretch', label: () => t('Mobility') },
  { path: '/assessments', icon: 'ruler', label: () => t('Tests') }
]

/** The paths that count as "inside Explore" (the tab bar lights its Explore tab for these). */
export const DISCOVER_PATHS = DISCOVER_SECTIONS.map(s => s.path)

// `current` is the section path of the screen rendering this (each Explore screen knows its own),
// which keeps the component free of router location state and trivial to test.
export default function DiscoverNav({ current }) {
  const nav = useNavigate()
  const on = p => p === current
  return (
    <nav className="chips discover-nav" aria-label={t('Explore')}>
      {DISCOVER_SECTIONS.map(s => (
        <button key={s.path} className={'chip nocap' + (on(s.path) ? ' on' : '')} aria-current={on(s.path) ? 'page' : undefined}
          onClick={() => { if (!on(s.path)) nav(s.path) }}>
          <Icon name={s.icon} style={{ fontSize: 14, marginInlineEnd: 5 }} />{s.label()}
        </button>
      ))}
    </nav>
  )
}

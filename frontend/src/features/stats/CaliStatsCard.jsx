// Stats → "Skills & mobility": openBody's numbers next to the ones openGym already had.
//   · tiles: skills mastered, ladder steps unlocked, and your mobility from the last test day
//   · 8 weeks of strength-hold minutes (accent) vs mobility minutes (amber), side by side
// Numbers come from lib/cali-stats.js and lib/assessments.js; this only draws them. Bars are
// plain divs (the app has no chart dependency for bars, and needs none for this).
import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { todayISO } from '../../lib/format.js'
import { weeklyTime, skillSummary } from '../../lib/cali-stats.js'
import { ASSESSMENTS, testRank, BAND_ORDER } from '../../lib/assessments.js'
import Icon from '../../components/Icon.jsx'
import { BandChip } from '../assessments/Assessments.jsx'
import './stats.css'

const minutes = s => Math.round(s / 60)

/** Mean rank over the tests you've taken (rounded to a band), or null if none. */
export function mobilityBand(S) {
  const ranks = ASSESSMENTS.map(test => testRank(S, test)).filter(r => r != null)
  return ranks.length ? BAND_ORDER[Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length)] : null
}

export default function CaliStatsCard({ S }) {
  const nav = useNavigate()
  const skills = skillSummary(S)
  const weeks = weeklyTime(S, todayISO(), 8)
  const band = mobilityBand(S)
  const max = Math.max(1, ...weeks.map(w => Math.max(w.holdSec, w.mobilitySec)))
  const thisWeek = weeks[weeks.length - 1]
  return <div className="card cs-card">
    <h2>{t('Skills & mobility')}</h2>
    <div className="cs-tiles">
      <button className="cs-tile" onClick={() => nav('/skills')}>
        <div className="l"><Icon name="crown" />{t('Skills mastered')}</div>
        <div className="v">{skills.mastered}<span className="dim"> / {skills.total}</span></div>
      </button>
      <button className="cs-tile" onClick={() => nav('/skills')}>
        <div className="l"><Icon name="steps" />{t('Steps unlocked')}</div>
        <div className="v">{skills.stepsUnlocked}</div>
      </button>
      <button className="cs-tile" onClick={() => nav('/assessments')}>
        <div className="l"><Icon name="ruler" />{t('Mobility')}</div>
        <div className="v">{band ? <BandChip label={band} /> : <span className="dim small">{t('Not tested yet')}</span>}</div>
      </button>
    </div>
    <div className="cs-chart" role="img" aria-label={t('Hold time and mobility time, last 8 weeks')}>
      {weeks.map(w => <div key={w.weekStart} className="cs-week" title={w.weekStart}>
        <span className="cs-bar hold" style={{ height: Math.round(w.holdSec / max * 100) + '%' }} />
        <span className="cs-bar mob" style={{ height: Math.round(w.mobilitySec / max * 100) + '%' }} />
      </div>)}
    </div>
    <div className="cs-legend small">
      <span><i className="hold" />{t('Holds: {0} min this week', minutes(thisWeek.holdSec))}</span>
      <span><i className="mob" />{t('Mobility: {0} min this week', minutes(thisWeek.mobilitySec))}</span>
    </div>
  </div>
}

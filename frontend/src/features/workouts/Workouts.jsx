// Explore → Workouts: openBody's ready-made sessions, browsed by muscle group or by mobility area,
// narrowed by level. A card opens the workout sheet (Start now / Add to plan).
//
// Workout names, descriptions and area names are catalogue content and English-only by design
// (spec §1 assumptions); every UI string around them goes through t().
import { useState } from 'react'
import { t } from '../../lib/i18n.js'
import { WORKOUTS, LEVELS, workoutGroups, iconOfWorkout, workoutRoutineOf } from '../../lib/workouts.js'
import { areaById } from '../../lib/areas.js'
import { useStore } from '../../store/useStore.js'
import { exCount } from '../../lib/format.js'
import { Segmented } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { tappable } from '../../lib/use-sheet-keyboard.js'
import DiscoverNav from '../discover/DiscoverNav.jsx'
import { workoutSheet } from './WorkoutSheet.jsx'
import { levelLabel, groupLabel, minutesLabel } from './labels.js'
import './workouts.css'

export default function Workouts() {
  const S = useStore(s => s.S)
  const [kind, setKind] = useState('muscle')
  const [level, setLevel] = useState('')
  const groups = workoutGroups(WORKOUTS, kind, level)

  return <>
    <div className="hdr"><div><h1>{t('Workouts')}</h1>
      <div className="sub">{t('Ready-made sessions by muscle group and body area.')}</div></div></div>
    <DiscoverNav current="/workouts" />
    <Segmented className="seg-range wk-kind" value={kind} onChange={setKind}
      options={[{ value: 'muscle', label: t('By muscle') }, { value: 'area', label: t('By area') }]} />
    <div className="chips" style={{ margin: '10px 0 12px' }}>
      <button className={'chip nocap' + (!level ? ' on' : '')} onClick={() => setLevel('')}>{t('Any level')}</button>
      {LEVELS.map(l => <button key={l} className={'chip nocap' + (level === l ? ' on' : '')} onClick={() => setLevel(l)}>{levelLabel(l)}</button>)}
    </div>
    {groups.map(g => (
      <section key={g.group} className="wk-group">
        <h4 className="sec">{kind === 'area' ? (areaById(g.group)?.name || g.group) : groupLabel(g.group)}</h4>
        <div className="list">
          {g.items.map(w => {
            const saved = !!workoutRoutineOf(S, w.id)
            return <div key={w.id} className="item wk-item" {...tappable(() => workoutSheet(w))}>
              <span className={'lrow-i wk-ico wk-' + w.level}><Icon name={iconOfWorkout(w)} /></span>
              <div className="grow">
                <div className="tt">{w.name}</div>
                <div className="ss">{levelLabel(w.level)} · {minutesLabel(w.minutes)} · {exCount(w.ex.length)}</div>
              </div>
              {saved && <span className="tag acc">{t('In your plan')}</span>}
              <Icon name="chevronRight" className="chev" />
            </div>
          })}
        </div>
      </section>
    ))}
    {!groups.length && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
  </>
}

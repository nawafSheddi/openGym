// Explore → Mobility: the guided flows. A card opens a preview sheet with every hold; "Start flow"
// opens the hands-free player. A flow left running shows a Resume banner on top.
// Flow names, cues and area names are catalogue content (English, spec §1).
import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { useUI } from '../../store/useUI.js'
import { FLOWS, flowById, totalSeconds } from '../../lib/flow-player.js'
import { areaById } from '../../lib/areas.js'
import { EXIDX } from '../../lib/exercises.js'
import { exerciseNameFor, exerciseNameClass } from '../../lib/i18n.js'
import { Thumb } from '../../components/Media.jsx'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { tappable } from '../../lib/use-sheet-keyboard.js'
import DiscoverNav from '../discover/DiscoverNav.jsx'
import { levelLabel, minutesLabel } from '../workouts/labels.js'
import { startFlowPlayer } from './flow-actions.js'
import { useFlowStore } from './flow-store.js'
import './flows.css'

// The areas a flow works, at most three, so a full-body flow's card stays two lines.
const areaList = ids => ids.slice(0, 3).map(a => areaById(a)?.name || a).join(', ') + (ids.length > 3 ? ', …' : '')

/** Minutes a flow takes, holds plus get-ready, rounded up. */
export const flowMinutes = f => Math.ceil(totalSeconds(f) / 60)

function FlowSheet({ flow, close }) {
  return <>
    <h3>{flow.name}</h3>
    <div className="muted small" style={{ marginBottom: 6 }}>{levelLabel(flow.level)} · {minutesLabel(flowMinutes(flow))}</div>
    {flow.description && <p className="small" style={{ margin: '0 0 12px', lineHeight: 1.4 }}>{flow.description}</p>}
    <div className="list" style={{ marginBottom: 14 }}>
      {flow.items.map((it, i) => {
        const ex = EXIDX[it.exId]
        if (!ex) return null
        return <div key={i} className="item">
          <Thumb ex={ex} />
          <div className="grow"><div className={`tt ${exerciseNameClass(ex)}`}>{exerciseNameFor(ex)}</div>
            <div className="ss">{t('{0} s', it.sec)}{it.side ? ' · ' + t('per side') : ''}</div></div>
        </div>
      })}
    </div>
    <Button variant="primary" icon="play" onClick={() => { close(); startFlowPlayer(flow) }}>{t('Start flow')}</Button>
  </>
}
export const flowSheet = flow => useUI.getState().openSheet(close => <FlowSheet flow={flow} close={close} />)

export default function Flows() {
  const nav = useNavigate()
  const active = useFlowStore(s => s.flow)
  const running = active && flowById(active.flowId)
  return <>
    <div className="hdr"><div><h1>{t('Mobility')}</h1>
      <div className="sub">{t('Guided routines that run on their own: follow the timer, breathe, switch sides.')}</div></div></div>
    <DiscoverNav current="/flows" />
    {running && <div className="card fl-resume" {...tappable(() => nav('/flow'))}>
      <Icon name="play" /><div className="grow"><div className="tt">{t('Resume flow')}</div><div className="ss">{running.name}</div></div>
      <Icon name="chevronRight" className="chev" />
    </div>}
    <div className="list">
      {FLOWS.map(f => <div key={f.id} className="item" {...tappable(() => flowSheet(f))}>
        <span className="lrow-i fl-ico"><Icon name="stretch" /></span>
        <div className="grow">
          <div className="tt">{f.name}</div>
          <div className="ss">{minutesLabel(flowMinutes(f))} · {levelLabel(f.level)} · {areaList(f.areas)}</div>
        </div>
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </div>
  </>
}

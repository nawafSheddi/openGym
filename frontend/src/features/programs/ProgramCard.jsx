// Home's program card. Following a program: its name, the week you're in, how many planned
// sessions you've done, today's scheduled mobility flow (one tap to start it), and a nudge when
// the program's next flexibility test day is due. Not following one: an invitation to pick one.
import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { useStore } from '../../store/useStore.js'
import { programById, programWeek, todaysFlow, adherence, leaveProgram } from '../../lib/programs.js'
import { flowById } from '../../lib/flow-player.js'
import { isDue } from '../../lib/assessments.js'
import { todayISO } from '../../lib/format.js'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { confirmSheet } from '../../sheets.jsx'
import { startFlowPlayer } from '../flows/flow-actions.js'
import { programsSheet } from './ProgramsSheet.jsx'
import './programs.css'

export default function ProgramCard() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const program = S.program && programById(S.program.id)
  if (!program) {
    return <div className="card pg-card">
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <span className="lrow-i pg-ico"><Icon name="clipboard" /></span><h2 style={{ margin: 0 }}>{t('Follow a program')}</h2></div>
      <div className="muted small" style={{ marginBottom: 12 }}>{t('Ready-made weeks of strength, skills and mobility. Pick one and your plan fills itself in.')}</div>
      <Button variant="primary" icon="clipboard" onClick={programsSheet}>{t('Choose a program')}</Button>
    </div>
  }
  const today = todayISO()
  const wk = programWeek(S, program, today)
  const adh = adherence(S, program, today)
  const flow = flowById(todaysFlow(program, today))
  const flowDone = flow && (S.workouts || []).some(w => w.d === today && w.flow === flow.id)
  const testDue = program.assessEveryWeeks && isDue(S, Date.now(), program.assessEveryWeeks * 7)
  const leave = () => confirmSheet({
    title: t('Leave {0}?', program.name),
    message: t('Your routines and weekly plan stay as they are.'),
    confirmText: t('Leave program'),
    onConfirm: () => useStore.getState().update(s => { leaveProgram(s) })
  })
  return <div className="card pg-card">
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <div><div className="small dim">{t('Program')}</div><div className="pg-name">{program.name}</div></div>
      <button className="iconbtn" aria-label={t('Leave program')} onClick={leave}><Icon name="xmark" /></button>
    </div>
    <div className="pg-stats">
      <div><div className="pg-big">{wk.done ? t('Done') : t('Week {0}', wk.week)}</div><div className="small dim">{t('of {0}', wk.weeks)}</div></div>
      <div><div className="pg-big">{adh.planned ? Math.round(adh.done / adh.planned * 100) + '%' : '–'}</div><div className="small dim">{t('{0} of {1} sessions', adh.done, adh.planned)}</div></div>
    </div>
    <div className="pg-bar"><span style={{ width: Math.round(Math.min(1, (wk.done ? wk.weeks : wk.week - 1) / wk.weeks) * 100) + '%' }} /></div>
    {flow && <Button variant={flowDone ? 'plain' : 'tinted'} icon={flowDone ? 'check' : 'stretch'} onClick={() => !flowDone && startFlowPlayer(flow)} style={{ marginTop: 10 }}>
      {flowDone ? t('Mobility done today: {0}', flow.name) : t('Today’s mobility: {0}', flow.name)}
    </Button>}
    {testDue && <Button variant="plain" icon="ruler" onClick={() => nav('/assessments')} style={{ marginTop: 6 }}>{t('Test day is due')}</Button>}
    {wk.done && <Button variant="plain" icon="clipboard" onClick={programsSheet} style={{ marginTop: 6 }}>{t('Choose your next program')}</Button>}
  </div>
}

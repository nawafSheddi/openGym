// Choosing a built-in program (replaces openGym's starter-plan chooser everywhere it was offered:
// Home, Plan, Settings). The list, then one program's detail: what it is, its week, and Start.
// Starting asks first when the program's weekdays already hold routines of yours; your routines
// themselves are never removed (lib/programs.js).
import { t } from '../../lib/i18n.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { PROGRAMS, takenDays, enroll } from '../../lib/programs.js'
import { flowById } from '../../lib/flow-player.js'
import { DAYN, todayISO } from '../../lib/format.js'
import { dateLocale } from '../../lib/i18n-core.js'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { tappable } from '../../lib/use-sheet-keyboard.js'
import { confirmSheet } from '../../sheets.jsx'
import { closeThenNav } from '../../lib/nav.js'
import { levelLabel } from '../workouts/labels.js'

// Monday-first week for display.
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const dayList = days => new Intl.ListFormat(dateLocale()).format(days.map(d => t(DAYN[d])))

/** Enroll now (inside one store update) and tell the user. */
export function startProgram(program) {
  useStore.getState().update(s => { enroll(s, program, { today: todayISO() }) })
  useUI.getState().toast(t('{0} started', program.name))
}

function ProgramDetail({ program, close }) {
  const S = useStore(s => s.S)
  const routineName = key => program.routines.find(r => r.key === key)?.name || key
  const start = () => {
    const taken = takenDays(S, program)
    const go = () => { startProgram(program); closeThenNav(close, '/plan') }
    if (!taken.length) { go(); return }
    close()
    confirmSheet({
      title: t('Start {0}?', program.name),
      message: t('The program goes on {0}. Your existing routines stay; only those days of the weekly plan change.', dayList(taken)),
      confirmText: t('Start program'),
      onConfirm: () => { startProgram(program) }
    })
  }
  return <>
    <h3>{program.name}</h3>
    <div className="muted small" style={{ marginBottom: 6 }}>{levelLabel(program.level)} · {t('{0} weeks', program.weeks)}</div>
    <p className="small" style={{ margin: '0 0 12px', lineHeight: 1.45 }}>{program.description}</p>
    <h4 className="sec">{t('Your week')}</h4>
    <div className="list" style={{ marginBottom: 14 }}>
      {WEEK.map(d => {
        const r = program.schedule.filter(([day]) => day === d).map(([, k]) => routineName(k))
        const f = (program.flows || []).filter(([day]) => day === d).map(([, id]) => flowById(id)?.name || id)
        return <div key={d} className="item pg-day">
          <div className="pg-wd">{t(DAYN[d])}</div>
          <div className="grow small">
            {r.map(n => <div key={n}><Icon name="pullup" style={{ fontSize: 13 }} /> {n}</div>)}
            {f.map(n => <div key={n} className="dim"><Icon name="stretch" style={{ fontSize: 13 }} /> {n}</div>)}
            {!r.length && !f.length && <span className="dim">{t('Rest')}</span>}
          </div>
        </div>
      })}
    </div>
    <Button variant="primary" icon="play" onClick={start}>{t('Start program')}</Button>
  </>
}

function ProgramsList({ close }) {
  const current = useStore(s => s.S.program?.id)
  const open = p => { close(); useUI.getState().openSheet(c => <ProgramDetail program={p} close={c} />) }
  return <>
    <h3>{t('Choose a program')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('A plan for every week, built from the routines, ladders and flows in openBody.')}</div>
    <div className="list">
      {PROGRAMS.map(p => <div key={p.id} className="item" {...tappable(() => open(p))}>
        <span className="lrow-i pg-ico"><Icon name="clipboard" /></span>
        <div className="grow"><div className="tt">{p.name}</div>
          <div className="ss">{levelLabel(p.level)} · {t('{0} weeks', p.weeks)} · {t('{0} days per week', new Set(p.schedule.map(([d]) => d)).size)}</div></div>
        {current === p.id && <span className="tag acc">{t('Current')}</span>}
        <Icon name="chevronRight" className="chev" />
      </div>)}
    </div>
  </>
}

export const programsSheet = () => useUI.getState().openSheet(close => <ProgramsList close={close} />)

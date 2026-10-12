// One skill's ladder (/skills/:id): every step as a node on a path. Steps behind you are done
// (amber check), the current one is highlighted with what it takes to move on and how close you
// are, the ones ahead are locked. From here you can:
//   · put the current step into a routine (it then follows the ladder: lib/ladder.js),
//   · say "I can already do this" on any step (a floor in S.skillOverrides), or go back to what
//     the log says.
import { useParams, useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { skillById, skillStatus, unlockProgress, entryDefaults } from '../../lib/ladder.js'
import { EXIDX } from '../../lib/exercises.js'
import { uid } from '../../lib/format.js'
import { Thumb } from '../../components/Media.jsx'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { tappable } from '../../lib/use-sheet-keyboard.js'
import { exerciseDetailSheet } from '../../sheets.jsx'
import { closeThenNav } from '../../lib/nav.js'
import { barLabel, bestLabel, stepCountLabel } from './labels.js'
import './skills.css'

/** Set (or clear, with null) the manual floor for one skill. Absent-safe on old states. */
export function setSkillOverride(skillId, index) {
  useStore.getState().update(s => {
    s.skillOverrides = { ...(s.skillOverrides || {}) }
    if (index == null) delete s.skillOverrides[skillId]
    else s.skillOverrides[skillId] = index
  })
}

/**
 * Add a skill's current step to a routine as a laddered entry (it then moves up by itself).
 * `rid` '_new' creates a routine named after the skill. Returns the routine id.
 */
export function addStepToRoutine(skill, index, rid) {
  const entry = entryDefaults(skill, index)
  let id = rid
  useStore.getState().update(s => {
    s.routines = s.routines || []
    if (rid === '_new') {
      id = uid()
      s.routines.push({ id, name: skill.name, emoji: 'logo', ex: [entry] })
    } else {
      const r = s.routines.find(x => x.id === rid)
      if (r) r.ex.push(entry)
    }
  })
  return id
}

// Pick a routine for the current step (same shape as the library's "Add to my plan").
function AddStepSheet({ skill, index, close }) {
  const routines = useStore(s => s.S.routines || [])
  const pick = rid => {
    const id = addStepToRoutine(skill, index, rid)
    const r = useStore.getState().S.routines.find(x => x.id === id)
    useUI.getState().toast(t('“{0}” added to {1}', skill.steps[index].label, r ? r.name : t('routine')))
    if (rid === '_new') closeThenNav(close, '/plan/r/' + id)
    else close()
  }
  return <>
    <h3>{t('Add to a routine')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('It moves up the ladder by itself as you unlock each step.')}</div>
    <div className="list">
      {routines.map(r => <div key={r.id} className="item" {...tappable(() => pick(r.id))}>
        <div className="grow"><div className="tt">{r.name}</div></div><Icon name="plus" className="chev" /></div>)}
      <div className="item" {...tappable(() => pick('_new'))}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="plusCircle" /></span>
        <div className="grow"><div className="tt">{t('New routine')}</div></div><Icon name="plus" className="chev" /></div>
    </div>
  </>
}

export default function SkillTree() {
  const { id } = useParams()
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const skill = skillById(id)
  if (!skill) return <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>
  const st = skillStatus(S, skill)
  const overridden = Number.isInteger(S.skillOverrides?.[skill.id])

  return <>
    <div className="hdr sk-hdr">
      <button className="iconbtn" aria-label={t('Back')} onClick={() => nav('/skills')}><Icon name="chevronLeft" /></button>
      <div><h1>{skill.name}</h1><div className="sub">{st.mastered ? t('Mastered') : stepCountLabel(st.index + 1, st.total)}</div></div>
    </div>
    {skill.description && <p className="small muted" style={{ margin: '0 2px 14px', lineHeight: 1.4 }}>{skill.description}</p>}

    <ol className="sk-path">
      {skill.steps.map((step, i) => {
        const state = i < st.index || (st.mastered && i === st.index) ? 'done' : i === st.index ? 'current' : 'locked'
        const ex = EXIDX[step.exId]
        const p = state === 'current' ? unlockProgress(S, skill, i) : null
        return <li key={i} className={'sk-node ' + state}>
          <span className="sk-dot" aria-hidden="true">{state === 'done' ? <Icon name="check" /> : state === 'locked' ? <Icon name="lock" /> : i + 1}</span>
          <div className="sk-card item" {...(ex ? tappable(() => exerciseDetailSheet(ex)) : {})}>
            {ex && <Thumb ex={ex} />}
            <div className="grow">
              <div className="tt">{step.label}</div>
              <div className="ss">{t('Practice: {0}', barLabel(step.mode, step.target))}</div>
              <div className="ss">{t('To move on: {0}, in {1} sessions', barLabel(step.mode, step.unlock), step.unlock.sessions)}</div>
              {p && <div className="ss sk-progress">
                {t('Best: {0}', bestLabel(step.mode, p.best))} · {t('{0} of {1} sessions', p.sessionsMet, p.sessionsNeeded)}
              </div>}
              {step.cue && state !== 'locked' && <div className="ss sk-cue"><Icon name="lightbulb" /> {step.cue}</div>}
            </div>
          </div>
          {state === 'locked' && <button className="chip nocap sk-claim" onClick={() => setSkillOverride(skill.id, i)}>{t('I can already do this')}</button>}
        </li>
      })}
    </ol>

    <Button variant="primary" icon="plus" onClick={() => useUI.getState().openSheet(close => <AddStepSheet skill={skill} index={st.index} close={close} />)}>
      {t('Add to a routine')}
    </Button>
    {overridden && <><div style={{ height: 8 }} />
      <Button icon="reset" onClick={() => setSkillOverride(skill.id, null)}>{t('Go by my log only')}</Button></>}
  </>
}

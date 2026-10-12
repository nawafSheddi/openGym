// The hands-free guided-flow player (/flow). Big countdown ring, the hold's picture and cue, the
// side for unilateral holds, what comes next, and three controls: back, pause, skip.
//
// State: S.activeFlow (lib/flow-player.js, timestamp-based). This screen only renders it against
// a clock that ticks every 200 ms, and writes it back to the store when the phase actually
// changes, so a flow is not a stream of store writes and syncs. Leaving the screen does not
// stop the flow (the Mobility screen offers Resume); finishing logs it as a workout.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { exerciseNameFor } from '../../lib/i18n.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { flowById, tick, next, prev, pause, resume, remaining, current, isDone, isPaused } from '../../lib/flow-player.js'
import { EXIDX } from '../../lib/exercises.js'
import { useWakeLock } from '../../lib/wakelock.js'
import { beep, chime, unlock, vibrate } from '../../lib/sound.js'
import Media from '../../components/Media.jsx'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { saveFlowState, finishFlow, discardFlow } from './flow-actions.js'
import './flows.css'

const RING = 2 * Math.PI * 54   // circumference of the countdown ring (r = 54 in a 120 box)
// Catalogue names are stored lowercase and capitalised by CSS where they stand alone; inside a
// sentence ("Next: …") only the name's first letter is raised.
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// End early: keep what was held, throw it away, or carry on.
function EndSheet({ st, flow, close, onEnded }) {
  const anyHeld = (st.held || []).some(s => s > 0)
  return <>
    <h3>{t('End this flow?')}</h3>
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      {anyHeld && <Button variant="primary" icon="check" onClick={() => { close(); onEnded(finishFlow(st, flow)) }}>{t('Save and end')}</Button>}
      <Button icon="trash" onClick={() => { close(); discardFlow(); onEnded(null) }}>{t('Discard')}</Button>
      <Button onClick={close}>{t('Keep going')}</Button>
    </div>
  </>
}

export default function FlowPlayer() {
  const nav = useNavigate()
  const st = useStore(s => s.S.activeFlow)
  const sound = useStore(s => s.S.sound)
  const restSound = useStore(s => s.S.restSound)
  const [now, setNow] = useState(() => Date.now())
  const [done, setDone] = useState(null)        // { name, minutes } once finished here
  const cueRef = useRef('')                     // last countdown second we beeped for
  const finishedRef = useRef(false)             // the flow is logged once, whatever re-renders
  const flow = st ? flowById(st.flowId) : null

  // The screen stays on while a flow plays (the same lock the workout screen uses).
  useWakeLock(!!st && !isDone(st) && !isPaused(st))

  // The player is one screen: start it at the top, controls in reach, nothing to scroll to.
  useEffect(() => { window.scrollTo(0, 0) }, [])

  // The clock. 200 ms keeps the seconds display honest without burning the battery.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [])

  const live = st && flow ? tick(st, now) : null

  // Phase changes: persist, and signal them (sound + vibration). Finishing logs the workout.
  useEffect(() => {
    if (!live) return
    // Finished, whichever way it got there: the clock ran out (live is a new object) or Skip on
    // the last hold already persisted the finished state (live === st). Logged exactly once.
    if (isDone(live)) {
      if (finishedRef.current) return
      finishedRef.current = true
      chime(sound, restSound); vibrate([120, 80, 120])
      const w = finishFlow(live, flow)
      setDone({ name: flow.name, saved: !!w })
      return
    }
    if (live === st) return
    // a hold that just ended chimes; a hold that just began gets a single high beep
    if (live.i !== st.i) { chime(sound, restSound); vibrate(200) }
    else if (live.phase === 'hold') beep(sound, 1046, 0.18)
    saveFlowState(live)
  }, [live, st])

  // 3-2-1 countdown beeps before every phase change.
  const rem = live ? remaining(live, now) : 0
  useEffect(() => {
    if (!live || isPaused(live) || isDone(live)) return
    const key = `${live.i}-${live.phase}-${rem}`
    if (rem >= 1 && rem <= 3 && cueRef.current !== key) { cueRef.current = key; beep(sound, 660, 0.12) }
  }, [rem, live])

  if (done) return <div className="fl-done">
    <div className="fl-done-ico"><Icon name="checkCircle" /></div>
    <h1>{t('Flow complete')}</h1>
    <div className="muted">{done.name}</div>
    {done.saved && <div className="small dim" style={{ marginTop: 6 }}>{t('Saved to your history.')}</div>}
    <div style={{ display: 'grid', gap: 8, marginTop: 24, width: '100%' }}>
      <Button variant="primary" onClick={() => nav('/home')}>{t('Done')}</Button>
      <Button onClick={() => nav('/flows')}>{t('More flows')}</Button>
    </div>
  </div>

  if (!live) return <div className="empty"><div className="ico"><Icon name="stretch" /></div>{t('No flow running.')}
    <div style={{ marginTop: 12 }}><Button onClick={() => nav('/flows')}>{t('Mobility')}</Button></div></div>

  // finished: the effect above is logging it and switching to the completion screen
  if (isDone(live)) return null

  const { index, phase, step } = current(live)
  const ex = EXIDX[step.exId]
  const paused = isPaused(live)
  const total = (phase === 'transition' ? live.transitionSec : step.sec) || 1
  const nextStep = live.steps[index + 1]
  // A control acts on the store's latest state, not on `live` from the last render: two quick
  // taps can land before React re-renders, and both must count (the second used to be lost).
  const act = fn => {
    unlock(sound)
    const at = Date.now()
    const latest = useStore.getState().S.activeFlow
    if (latest) saveFlowState(fn(tick(latest, at), at))
    setNow(at)
  }
  const end = () => useUI.getState().openSheet(close => <EndSheet st={live} flow={flow} close={close}
    onEnded={w => (w ? setDone({ name: flow.name, saved: true }) : nav('/flows'))} />)

  return <div className={'fl-player' + (phase === 'transition' ? ' get-ready' : '') + (paused ? ' paused' : '')}>
    <div className="fl-top">
      <button className="iconbtn" aria-label={t('Close')} onClick={end}><Icon name="xmark" /></button>
      <div className="fl-title"><div className="tt">{flow.name}</div><div className="ss">{t('{0} of {1}', index + 1, live.steps.length)}</div></div>
      <span style={{ width: 40 }} />
    </div>
    <div className="fl-bar"><span style={{ width: Math.round(index / live.steps.length * 100) + '%' }} /></div>

    {ex && <div className="fl-media"><Media ex={ex} /></div>}
    <h2 className="fl-name">{ex ? exerciseNameFor(ex) : step.exId}</h2>
    {step.side && <div className="fl-side">{step.side === 'L' ? t('Left side') : t('Right side')}</div>}

    <div className="fl-ring" role="timer" aria-live="off">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="54" className="fl-ring-bg" />
        <circle cx="60" cy="60" r="54" className="fl-ring-fg" strokeDasharray={RING}
          strokeDashoffset={RING * (1 - Math.min(1, rem / total))} />
      </svg>
      <div className="fl-count"><div className="fl-secs">{rem}</div>
        <div className="fl-phase">{paused ? t('Paused') : phase === 'transition' ? t('Get ready') : t('Hold')}</div></div>
    </div>

    {step.cue && <div className="fl-cue"><Icon name="lightbulb" /> {step.cue}</div>}
    <div className="fl-next small dim">{nextStep
      ? t('Next: {0}', cap(EXIDX[nextStep.exId] ? exerciseNameFor(EXIDX[nextStep.exId]) : nextStep.exId) + (nextStep.side ? ` (${nextStep.side === 'L' ? t('Left side') : t('Right side')})` : ''))
      : t('Last one')}</div>

    <div className="fl-controls">
      <button className="iconbtn fl-ctl" aria-label={t('Back')} onClick={() => act(prev)}><Icon name="chevronLeft" /></button>
      <button className="fl-play" aria-label={paused ? t('Resume') : t('Pause')} onClick={() => act(paused ? resume : pause)}>
        <Icon name={paused ? 'play' : 'pause'} /></button>
      <button className="iconbtn fl-ctl" aria-label={t('Skip')} onClick={() => act(next)}><Icon name="skipForward" /></button>
    </div>
  </div>
}

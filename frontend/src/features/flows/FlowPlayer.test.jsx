// @vitest-environment happy-dom
// Regression (2026-10-13): skipping past the last hold persisted a *finished* player state; the
// screen then crashed reading the current step (null when done) and never logged the flow.
// A finished state must log the workout once and show the completion screen, however the
// state got finished (timer running out, or a Skip on the last hold).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
vi.mock('../../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../../lib/nav.js', () => ({ nav: vi.fn(), closeThenNav: vi.fn(), navToWorkout: vi.fn() }))

import { useStore, DEF } from '../../store/useStore.js'
import FlowPlayer from './FlowPlayer.jsx'
import { flowById, init, tick, next, isPaused } from '../../lib/flow-player.js'
import { getActiveFlow, setActiveFlow } from './flow-store.js'

const mounted = []
function render() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<FlowPlayer />))
  return host
}
afterEach(() => {
  act(() => { mounted.splice(0).forEach(r => r.unmount()) })
  document.body.innerHTML = ''
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)) })
  setActiveFlow(null)
})

describe('FlowPlayer', () => {
  const flow = flowById('wrist-prep')

  it('renders the current hold of a running flow', () => {
    const now = Date.now()
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), workouts: [] } })
    setActiveFlow(tick(init(flow, now - 7000), now))
    const host = render()
    expect(host.querySelector('.fl-player')).not.toBeNull()
    expect(host.querySelector('.fl-secs').textContent).toMatch(/^\d+$/)
  })

  it('a finished state persisted by Skip logs the flow once and shows the completion screen', () => {
    const now = Date.now()
    // hold the first exercise for 7 s, then skip through everything to the end
    let st = tick(init(flow, now - 12000), now)
    for (let k = 0; k < 100 && st.phase !== 'done'; k++) st = next(st, now)
    expect(st.phase).toBe('done')
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), workouts: [] } })
    setActiveFlow(st)
    let host
    expect(() => { host = render() }).not.toThrow()
    expect(host.querySelector('.fl-done')).not.toBeNull()
    const S = useStore.getState().S
    expect(getActiveFlow()).toBe(null)
    expect(S.workouts.filter(w => w.flow === 'wrist-prep')).toHaveLength(1)
    // a re-render does not log it again
    act(() => { mounted[0].render(<FlowPlayer />) })
    expect(useStore.getState().S.workouts).toHaveLength(1)
  })
})

describe('FlowPlayer: holds only count while someone is watching', () => {
  const flow = flowById('wrist-prep')

  it('reopening a flow a day later settles it paused instead of logging every hold', () => {
    const now = Date.now()
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), workouts: [] } })
    setActiveFlow(tick(init(flow, now - 86400000), now - 86400000 + 9000))   // left a day ago, 4 s into hold 1
    const host = render()
    expect(host.querySelector('.fl-done')).toBe(null)
    expect(isPaused(getActiveFlow())).toBe(true)
    expect(getActiveFlow().held.filter(Boolean)).toHaveLength(1)            // only the hold that was running
    expect(useStore.getState().S.workouts).toHaveLength(0)
  })

  it('leaving the player pauses the flow', () => {
    const now = Date.now()
    useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), workouts: [] } })
    setActiveFlow(tick(init(flow, now - 7000), now))
    render()
    act(() => { mounted.splice(0).forEach(r => r.unmount()) })
    expect(isPaused(getActiveFlow())).toBe(true)
  })
})

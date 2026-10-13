// @vitest-environment happy-dom
// Guided-flow actions: the running flow lives on this device only (flow-store.js, never synced),
// finishing logs one ordinary workout tagged with the flow, nothing held means nothing logged,
// and the same flow can never be logged twice.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('../../lib/nav.js', () => ({ nav: vi.fn(), closeThenNav: vi.fn(), navToWorkout: vi.fn() }))

import { useStore, DEF } from '../../store/useStore.js'
import { startFlowPlayer, finishFlow, discardFlow } from './flow-actions.js'
import { getActiveFlow, setActiveFlow, FLOW_KEY } from './flow-store.js'
import { flowById, tick } from '../../lib/flow-player.js'

const reset = () => {
  useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), workouts: [] }, user: null })
  setActiveFlow(null)
}
afterEach(reset)

describe('flow actions', () => {
  const flow = flowById('wrist-prep')
  const T0 = 1_700_000_000_000

  it('start keeps the player on this device (localStorage), never in the synced state', () => {
    reset()
    startFlowPlayer(flow, T0)
    expect(getActiveFlow()).toMatchObject({ flowId: 'wrist-prep', i: 0, startedAt: T0 })
    expect(JSON.parse(localStorage.getItem(FLOW_KEY)).startedAt).toBe(T0)
    expect(useStore.getState().S.activeFlow).toBeUndefined()
  })

  it('finishing a completed flow logs one workout tagged with the flow and clears the player', () => {
    reset()
    startFlowPlayer(flow, T0)
    const done = tick(getActiveFlow(), T0 + 3600 * 1000)
    const w = finishFlow(done, flow, T0 + 3600 * 1000)
    const S = useStore.getState().S
    expect(getActiveFlow()).toBe(null)
    expect(localStorage.getItem(FLOW_KEY)).toBe(null)
    expect(S.workouts).toHaveLength(1)
    expect(S.workouts[0]).toMatchObject({ id: w.id, flow: 'wrist-prep', name: flow.name })
    // History shows every workout's volume: it must be a number (it read "NaN kg" before)
    expect(Number.isFinite(S.workouts[0].vol)).toBe(true)
    expect(S.workouts[0].entries.every(e => e.sets.every(s => s.done && s.sec > 0))).toBe(true)
  })

  it('never logs the same flow twice (a late "Save and end" after the timer already finished it)', () => {
    reset()
    startFlowPlayer(flow, T0)
    const done = tick(getActiveFlow(), T0 + 3600 * 1000)
    expect(finishFlow(done, flow)).not.toBe(null)
    expect(finishFlow(done, flow)).toBe(null)
    expect(useStore.getState().S.workouts).toHaveLength(1)
  })

  it('a stale state from an earlier run of the flow is not logged', () => {
    reset()
    startFlowPlayer(flow, T0)
    const old = tick(getActiveFlow(), T0 + 3600 * 1000)
    startFlowPlayer(flow, T0 + 5000)                 // restarted since
    expect(finishFlow(old, flow)).toBe(null)
    expect(useStore.getState().S.workouts).toHaveLength(0)
  })

  it('a flow ended before any hold logs nothing', () => {
    reset()
    startFlowPlayer(flow, T0)
    expect(finishFlow(getActiveFlow(), flow, T0 + 1000)).toBe(null)
    expect(useStore.getState().S.workouts).toHaveLength(0)
    expect(getActiveFlow()).toBe(null)
  })

  it('discard clears the player without logging', () => {
    reset()
    startFlowPlayer(flow, T0)
    discardFlow()
    expect(getActiveFlow()).toBe(null)
    expect(useStore.getState().S.workouts).toHaveLength(0)
  })
})

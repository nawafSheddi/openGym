// @vitest-environment happy-dom
// Guided-flow store actions: starting keeps the player in S.activeFlow, finishing logs one
// ordinary workout tagged with the flow, and nothing held means nothing logged.
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('../../lib/nav.js', () => ({ nav: vi.fn(), closeThenNav: vi.fn(), navToWorkout: vi.fn() }))

import { useStore, DEF } from '../../store/useStore.js'
import { startFlowPlayer, finishFlow, discardFlow } from './flow-actions.js'
import { flowById, tick } from '../../lib/flow-player.js'

const reset = () => useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), workouts: [] }, user: null })
afterEach(reset)

describe('flow actions', () => {
  const flow = flowById('wrist-prep')
  const T0 = 1_700_000_000_000

  it('start puts a fresh player in the store', () => {
    reset()
    startFlowPlayer(flow, T0)
    const st = useStore.getState().S.activeFlow
    expect(st).toMatchObject({ flowId: 'wrist-prep', i: 0, startedAt: T0 })
  })

  it('finishing a completed flow logs one workout tagged with the flow and clears the player', () => {
    reset()
    startFlowPlayer(flow, T0)
    const done = tick(useStore.getState().S.activeFlow, T0 + 3600 * 1000)
    const w = finishFlow(done, flow, T0 + 3600 * 1000)
    const S = useStore.getState().S
    expect(S.activeFlow).toBe(null)
    expect(S.workouts).toHaveLength(1)
    expect(S.workouts[0]).toMatchObject({ id: w.id, flow: 'wrist-prep', name: flow.name })
    // History shows every workout's volume: it must be a number (it read "NaN kg" before)
    expect(Number.isFinite(S.workouts[0].vol)).toBe(true)
    expect(S.workouts[0].entries.length).toBeGreaterThan(0)
    // every hold logged as a done timed set
    expect(S.workouts[0].entries.every(e => e.sets.every(s => s.done && s.sec > 0))).toBe(true)
  })

  it('a flow ended before any hold logs nothing', () => {
    reset()
    startFlowPlayer(flow, T0)
    expect(finishFlow(useStore.getState().S.activeFlow, flow, T0 + 1000)).toBe(null)
    expect(useStore.getState().S.workouts).toHaveLength(0)
    expect(useStore.getState().S.activeFlow).toBe(null)
  })

  it('discard clears the player without logging', () => {
    reset()
    startFlowPlayer(flow, T0)
    discardFlow()
    expect(useStore.getState().S.activeFlow).toBe(null)
    expect(useStore.getState().S.workouts).toHaveLength(0)
  })
})

// The running guided flow, kept on THIS device only.
//
// A flow being played is device-local playback state, not training data: if it lived in the
// synced store (S), a second tab or another signed-in device would pick it up, tick it from the
// same timestamps and log the same flow a second time (code review, 2026-10-13). The workout it
// produces at the end is what syncs. The app keeps its running workout (S.active) per device for
// the same reason, through carryActive; a flow gets the simpler route of never entering S at all.
//
// Persisted to localStorage, so a reload or a phone that killed the tab resumes the flow;
// lib/flow-player.js computes everything from the timestamps inside it. A storage failure
// (private mode, quota) only costs that resume, never the flow on screen.
import { create } from 'zustand'

export const FLOW_KEY = 'openbody_active_flow_v1'

function load() {
  try {
    const raw = localStorage.getItem(FLOW_KEY)
    const st = raw ? JSON.parse(raw) : null
    // a minimally sane player state, or nothing (a hand-edited or truncated value is dropped)
    return st && typeof st === 'object' && Array.isArray(st.steps) && typeof st.phaseStart === 'number' ? st : null
  } catch { return null }
}

export const useFlowStore = create(() => ({ flow: load() }))

/** The running flow's player state, or null. */
export const getActiveFlow = () => useFlowStore.getState().flow

/** Replace (or clear, with null) the running flow, here and in localStorage. */
export function setActiveFlow(st) {
  useFlowStore.setState({ flow: st || null })
  try {
    if (st) localStorage.setItem(FLOW_KEY, JSON.stringify(st))
    else localStorage.removeItem(FLOW_KEY)
  } catch { /* storage unavailable: the flow still runs, it just won't survive a reload */ }
}

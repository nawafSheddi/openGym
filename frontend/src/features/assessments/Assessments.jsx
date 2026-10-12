// Explore → Tests: openBody's flexibility assessments.
//   · Mobility map: the body map shaded by how each tested area scores (poor → elite).
//   · Test day: step through every test, log what you measure (both sides where it matters).
//   · Each test: how to measure it, its benchmark bands, your trend chart and past results.
// Test names and instructions are catalogue content (English, spec §1); UI strings use t().
import { useState } from 'react'
import { t } from '../../lib/i18n.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import {
  ASSESSMENTS, bandOf, latest, testRank, trend, resultsFor, mobilityLoad, MOBILITY_THRESHOLDS,
  lastTestDate, isDue, displayUnit, toDisplay, BAND_ORDER
} from '../../lib/assessments.js'
import { fmtDate } from '../../lib/format.js'
import BodyMap from '../../components/BodyMap.jsx'
import LineChart from '../../components/LineChart.jsx'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { tappable } from '../../lib/use-sheet-keyboard.js'
import DiscoverNav from '../discover/DiscoverNav.jsx'
import ResultInput from './ResultInput.jsx'
import { saveResults, removeResult } from './assess-actions.js'
import { bandLabel, valueText } from './labels.js'
import './assessments.css'

/** A band chip (Poor … Elite), coloured by rank. */
export function BandChip({ label }) {
  return <span className={'tag as-band as-' + label}>{bandLabel(label)}</span>
}

// The inputs for one test: one field, or left and right.
function TestInputs({ test, unit, vals, setVals }) {
  const set = k => v => setVals(o => ({ ...o, [k]: v }))
  return test.sided
    ? <div className="as-inputs"><ResultInput test={test} unit={unit} label={t('Left')} value={vals.L ?? null} onChange={set('L')} />
        <ResultInput test={test} unit={unit} label={t('Right')} value={vals.R ?? null} onChange={set('R')} /></div>
    : <div className="as-inputs"><ResultInput test={test} unit={unit} value={vals.v ?? null} onChange={set('v')} /></div>
}
const entriesOf = (test, vals) => (test.sided
  ? [['L', vals.L], ['R', vals.R]].filter(([, v]) => v != null).map(([side, value]) => ({ test, value, side }))
  : vals.v != null ? [{ test, value: vals.v }] : [])

// Test day: one test per page, Skip or Next, saves everything at the end.
function TestDay({ close }) {
  const unit = useStore(s => s.S.unit)
  const [i, setI] = useState(0)
  const [all, setAll] = useState({})          // testId → { v } | { L, R }
  const test = ASSESSMENTS[i]
  const vals = all[test.id] || {}
  const setVals = fn => setAll(o => ({ ...o, [test.id]: fn(o[test.id] || {}) }))
  const last = i === ASSESSMENTS.length - 1
  const finish = () => {
    const n = saveResults(ASSESSMENTS.flatMap(tst => entriesOf(tst, all[tst.id] || {})))
    useUI.getState().toast(n ? t('Saved {0} results.', n) : t('Nothing logged.'))
    close()
  }
  return <>
    <div className="small dim">{t('Test {0} of {1}', i + 1, ASSESSMENTS.length)}</div>
    <h3 style={{ marginTop: 2 }}>{test.name}</h3>
    <ol className="as-steps small">{test.instructions.map((s, k) => <li key={k}>{s}</li>)}</ol>
    <TestInputs test={test} unit={unit} vals={vals} setVals={setVals} />
    <div className="row" style={{ gap: 8, marginTop: 14 }}>
      {i > 0 && <Button icon="chevronLeft" onClick={() => setI(i - 1)}>{t('Back')}</Button>}
      {last ? <Button variant="primary" icon="check" onClick={finish}>{t('Save results')}</Button>
        : <Button variant="primary" trailingIcon="chevronRight" onClick={() => setI(i + 1)}>{entriesOf(test, vals).length ? t('Next') : t('Skip')}</Button>}
    </div>
  </>
}

// One test: how to do it, the bands, the trend and past results, log one now.
function TestSheet({ test, close }) {
  const S = useStore(s => s.S)
  const [vals, setVals] = useState({})
  const shownUnit = displayUnit(test, S.unit)
  const show = v => valueText(toDisplay(test, v, S.unit), shownUnit)
  const sides = test.sided ? ['L', 'R'] : [null]
  const history = resultsFor(S, test.id).slice().reverse()
  const save = () => {
    const n = saveResults(entriesOf(test, vals))
    if (n) { setVals({}); useUI.getState().toast(t('Saved {0} results.', n)) }
  }
  return <>
    <h3>{test.name}</h3>
    <ol className="as-steps small">{test.instructions.map((s, k) => <li key={k}>{s}</li>)}</ol>
    <div className="as-bands">
      {/* the benchmark scale, worst to best, with each band's threshold in the display unit */}
      {BAND_ORDER.map(label => {
        const b = test.bands.find(x => x.label === label)
        const i = test.bands.indexOf(b)
        const lo = i > 0 ? test.bands[i - 1].below : null, hi = b.below ?? null
        const range = lo == null ? `< ${show(hi)}` : hi == null ? `≥ ${show(lo)}` : `${toDisplay(test, lo, S.unit)}–${show(hi)}`
        return <div key={label} className="as-band-row"><BandChip label={label} /><span className="small dim">{range}</span></div>
      })}
    </div>
    {sides.map(side => {
      const pts = trend(S, test.id, side).map(p => ({ ...p, y: toDisplay(test, p.y, S.unit) }))
      return pts.length > 1 && <div key={side || 'one'} className="chart" style={{ margin: '10px 0' }}>
        {side && <div className="small dim">{side === 'L' ? t('Left') : t('Right')}</div>}
        <LineChart points={pts} h={120} unit={shownUnit === 'deg' ? '°' : shownUnit} invert={test.better === 'lower'} />
      </div>
    })}
    <h4 className="sec">{t('Log a result')}</h4>
    <TestInputs test={test} unit={S.unit} vals={vals} setVals={setVals} />
    <Button variant="primary" icon="plus" style={{ marginTop: 10 }} onClick={save}>{t('Save')}</Button>
    {history.length > 0 && <><h4 className="sec">{t('History')}</h4>
      <div className="list">{history.map(r => <div key={r.id} className="item">
        <div className="grow"><div className="tt">{show(r.value)}{r.side ? ` · ${r.side === 'L' ? t('Left') : t('Right')}` : ''}</div>
          <div className="ss">{fmtDate(r.d)}</div></div>
        <BandChip label={bandOf(test, r.value).label} />
        <button className="iconbtn" aria-label={t('Delete')} onClick={() => removeResult(r.id)}><Icon name="trash" /></button>
      </div>)}</div></>}
  </>
}
export const testSheet = test => useUI.getState().openSheet(close => <TestSheet test={test} close={close} />)
export const testDaySheet = () => useUI.getState().openSheet(close => <TestDay close={close} />)

export default function Assessments() {
  const S = useStore(s => s.S)
  const load = mobilityLoad(S)
  const last = lastTestDate(S)
  return <>
    <div className="hdr"><div><h1>{t('Tests')}</h1>
      <div className="sub">{t('Measure your flexibility, see it improve.')}</div></div></div>
    <DiscoverNav current="/assessments" />
    <div className="card as-map">
      <div className="row between"><h2 style={{ margin: 0 }}>{t('Mobility map')}</h2>
        <span className="small dim">{last ? t('Last tested {0}', fmtDate(last)) : t('Not tested yet')}</span></div>
      <BodyMap load={load} thresholds={MOBILITY_THRESHOLDS} body={S.body === 'female' ? 'female' : 'male'} />
      <div className="as-legend small">{BAND_ORDER.map(l => <BandChip key={l} label={l} />)}</div>
    </div>
    <Button variant={isDue(S) ? 'primary' : 'tinted'} icon="ruler" onClick={testDaySheet}>
      {isDue(S) ? t('Start a test day') : t('Test again')}
    </Button>
    <h4 className="sec" style={{ marginTop: 16 }}>{t('All tests')}</h4>
    <div className="list">
      {ASSESSMENTS.map(test => {
        const l = latest(S, test)
        const rank = testRank(S, test)
        const u = displayUnit(test, S.unit)
        const txt = !l ? t('Not tested yet') : test.sided
          ? [['L', l.L], ['R', l.R]].filter(([, x]) => x).map(([s, x]) => `${s === 'L' ? t('L') : t('R')} ${valueText(toDisplay(test, x.value, S.unit), u)}`).join(' · ')
          : valueText(toDisplay(test, l.value, S.unit), u)
        return <div key={test.id} className="item" {...tappable(() => testSheet(test))}>
          <span className="lrow-i as-ico"><Icon name="ruler" /></span>
          <div className="grow"><div className="tt">{test.name}</div><div className="ss">{txt}</div></div>
          {rank != null && <BandChip label={BAND_ORDER[rank]} />}
          <Icon name="chevronRight" className="chev" />
        </div>
      })}
    </div>
  </>
}

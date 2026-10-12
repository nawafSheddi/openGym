// Explore → Skills: every skill ladder as a card, with the step you're on (derived from your log,
// lib/ladder.js) and how far up the ladder you are. A card opens its ladder (/skills/:id).
// Skill and step names are catalogue content (English, spec §1); UI strings go through t().
import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { useStore } from '../../store/useStore.js'
import { SKILLS, skillStatus } from '../../lib/ladder.js'
import { EXIDX } from '../../lib/exercises.js'
import { Thumb } from '../../components/Media.jsx'
import Icon from '../../components/Icon.jsx'
import { tappable } from '../../lib/use-sheet-keyboard.js'
import DiscoverNav from '../discover/DiscoverNav.jsx'
import { familyLabel, stepCountLabel } from './labels.js'
import './skills.css'

// Display order of skill families on the screen.
const FAMILIES = ['pull', 'push', 'core', 'legs', 'balance']

export default function Skills() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  return <>
    <div className="hdr"><div><h1>{t('Skills')}</h1>
      <div className="sub">{t('Step-by-step ladders, from the first variation to the full skill.')}</div></div></div>
    <DiscoverNav current="/skills" />
    {FAMILIES.map(f => {
      const list = SKILLS.filter(s => s.family === f)
      if (!list.length) return null
      return <section key={f}>
        <h4 className="sec">{familyLabel(f)}</h4>
        <div className="list">
          {list.map(skill => {
            const st = skillStatus(S, skill)
            const ex = EXIDX[st.step.exId]
            return <div key={skill.id} className="item sk-item" {...tappable(() => nav('/skills/' + skill.id))}>
              {ex ? <Thumb ex={ex} /> : <span className="lrow-i"><Icon name="logo" /></span>}
              <div className="grow">
                <div className="tt">{skill.name}</div>
                <div className="ss">{st.mastered ? t('Mastered') : st.step.label} · {stepCountLabel(st.index + 1, st.total)}</div>
                {/* the bar shows the share of the ladder behind you; amber once mastered */}
                <div className={'sk-bar' + (st.mastered ? ' done' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={st.total} aria-valuenow={st.mastered ? st.total : st.index}>
                  <span style={{ width: Math.round(st.fraction * 100) + '%' }} />
                </div>
              </div>
              {st.mastered && <Icon name="crown" className="sk-crown" />}
              <Icon name="chevronRight" className="chev" />
            </div>
          })}
        </div>
      </section>
    })}
  </>
}

// Feature stylesheets (src/features/*/*.css) load BEFORE index.css: main.jsx imports App (which
// pulls in every feature's CSS) and only then './index.css'. So when a feature class shares an
// element with an index.css class — className="lrow-i as-ico", "tag as-band", "chip sk-claim" —
// a rule written as a lone `.as-ico` ties with `.lrow-i` on specificity and loses on order.
// That shipped once: every flexibility band chip rendered the same grey (2026-10-13). Such rules
// must name the base class too (`.lrow-i.as-ico`), the way index.css itself writes `.tag.acc`.
//
// Static check: className string literals in a feature's JSX give the (feature class → base
// class) pairings; a bare `.feature-class` rule in that feature's CSS fails when it sets a
// property family the bare `.base` rule in index.css also sets. Limitation: a class built at runtime ('as-' + label) is not seen — its rules are covered
// only when its literal part (`tag as-band`) carries the pairing, so keep such families qualified.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const FEATURES = resolve(process.cwd(), 'src/features')
// index.css classes that sit on the same element as a feature class
const BASE = ['lrow-i', 'tag', 'chip', 'small']
// a complete feature class token (one ending in '-' is the literal half of a runtime-built name)
const FEATURE_CLASS = /^(as|discover|fl|pg|sk|cs|wk)-[a-z0-9-]*[a-z0-9]$/

/** Every `.jsx` and `.css` file directly inside one feature directory, by extension. */
function filesOf(dir) {
  const names = readdirSync(dir)
  const read = ext => names.filter(n => n.endsWith(ext) && !n.includes('.test.')).map(n => readFileSync(join(dir, n), 'utf8'))
  return { jsx: read('.jsx'), css: read('.css') }
}

/** feature class → the base classes it shares an element with, from quoted strings in the JSX. */
function pairings(jsxSources) {
  const out = new Map()
  for (const src of jsxSources) {
    for (const [, lit] of src.matchAll(/['"`]([^'"`\n]*)['"`]/g)) {
      const tokens = lit.trim().split(/\s+/)
      const bases = tokens.filter(t => BASE.includes(t))
      if (!bases.length) continue
      for (const t of tokens.filter(t => FEATURE_CLASS.test(t))) {
        out.set(t, new Set([...(out.get(t) || []), ...bases]))
      }
    }
  }
  return out
}

/** `{ sel, props }` for every selector (comma-split) of every style rule, comments stripped. */
function rules(css) {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, sel, body]) => {
    const props = [...body.matchAll(/([\w-]+)\s*:/g)].map(m => family(m[1]))
    return sel.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ sel: s, props }))
  })
}

// Longhands compete with their shorthand (`padding-top` vs `padding`), so compare by family.
const SHORTHANDS = ['background', 'padding', 'margin', 'border', 'font', 'inset']
const family = p => SHORTHANDS.find(s => p === s || p.startsWith(s + '-')) || p

// The properties index.css sets on each base class through a bare `.base` selector — the rule a
// lone feature class ties with. A feature rule that touches none of them cannot lose anything.
const indexRules = rules(readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8'))
const baseProps = new Map(BASE.map(b => [b, new Set(indexRules.filter(r => r.sel === '.' + b).flatMap(r => r.props))]))

describe('feature stylesheets vs index.css load order', () => {
  const dirs = readdirSync(FEATURES, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => join(FEATURES, d.name))

  it('finds the known pairings and base rules (the check is not vacuous)', () => {
    const all = new Map(dirs.flatMap(d => [...pairings(filesOf(d).jsx)]))
    expect(all.get('as-ico')).toContain('lrow-i')
    expect(all.get('as-band')).toContain('tag')
    expect(all.get('sk-claim')).toContain('chip')
    expect(baseProps.get('tag')).toContain('background')
    expect(baseProps.get('lrow-i')).toContain('color')
  })

  it('qualifies every lone feature class that shares an element with an index.css class', () => {
    const bad = []
    for (const dir of dirs) {
      const { jsx, css } = filesOf(dir)
      const paired = pairings(jsx)
      for (const { sel, props } of css.flatMap(rules)) {
        // a bare `.x` has specificity (0,1,0), the same as the index.css `.base` rule it
        // competes with, so it loses on order; anything more specific already wins
        const cls = sel.match(/^\.([\w-]+)$/)?.[1]
        if (!cls || !paired.has(cls)) continue
        for (const base of paired.get(cls)) {
          const lost = props.filter(p => baseProps.get(base).has(p))
          if (lost.length) bad.push(`${sel} loses ${[...new Set(lost)].join(', ')} to .${base}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})

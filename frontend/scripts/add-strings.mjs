#!/usr/bin/env node
// Adds a batch of NEW UI strings to every locale pack in one go.
//
//   node scripts/add-strings.mjs <batch.json> [--section "openBody: skills"]
//
// batch.json maps each English source string (the key t() is called with) to its translation in
// every language the app ships:
//
//   { "Skill tree": { "ar": "…", "bn": "…", "de": "Skill-Baum", …, "zh-TW": "…" } }
//
// Why a script: check-locales.mjs requires every key in every pack, and openBody adds strings in
// batches per feature. Editing 18 files by hand per batch invites the exact drift that check
// exists to catch. This keeps the batch atomic: either every language gets the string, or the
// script refuses and nothing is written.
//
// pt-BR is special: it inherits pt-PT and only lists its differences in PT_BR_OVERRIDES, and a
// test fingerprints every inherited entry. A new string therefore goes into PT_BR_OVERRIDES
// explicitly (with the Brazilian wording), so pt-PT additions never change what pt-BR inherits.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales')
// Every pack file name without .js. pt-BR handled specially below.
const LANGS = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort()

/** JS source for one entry. JSON string syntax is valid JS and escapes quotes/newlines safely. */
const entry = (k, v) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`

/**
 * Insert `lines` into a pack's source. Regular packs: before the closing `}` of the default
 * export (the last `}` line). pt-BR: before the `}` that closes PT_BR_OVERRIDES.
 * Exported for tests.
 */
export function insertInto(src, lang, lines, section) {
  const block = (section ? `  // --- ${section} ---\n` : '') + lines
  if (lang === 'pt-BR') {
    const marker = '\n}\n\nexport default { ...pt, ...PT_BR_OVERRIDES }'
    const i = src.lastIndexOf(marker)
    if (i < 0) throw new Error('pt-BR.js: PT_BR_OVERRIDES closing marker not found')
    return src.slice(0, i + 1) + block + src.slice(i + 1)
  }
  const i = src.lastIndexOf('\n}')
  if (i < 0) throw new Error(`${lang}.js: closing brace not found`)
  return src.slice(0, i + 1) + block + src.slice(i + 1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, ...rest] = process.argv.slice(2)
  if (!file) { console.error('usage: node scripts/add-strings.mjs <batch.json> [--section name]'); process.exit(2) }
  const si = rest.indexOf('--section')
  const section = si >= 0 ? rest[si + 1] : null
  const batch = JSON.parse(fs.readFileSync(file, 'utf8'))

  // Validate everything before writing anything.
  const problems = []
  const sources = Object.fromEntries(LANGS.map(l => [l, fs.readFileSync(path.join(dir, l + '.js'), 'utf8')]))
  for (const [key, tr] of Object.entries(batch)) {
    for (const l of LANGS) {
      const v = tr[l]
      if (typeof v !== 'string' || !v.trim()) problems.push(`"${key}": missing ${l}`)
      // keep {0} placeholders intact, the same rule check-locales.mjs enforces
      const ph = s => (s.match(/\{\d+\}/g) || []).sort().join()
      if (typeof v === 'string' && ph(v) !== ph(key)) problems.push(`"${key}": ${l} placeholders differ`)
      // refuse duplicates: a key already in a pack (JSON- or single-quoted) would be shadowed
      if (sources[l].includes(JSON.stringify(key) + ':') || sources[l].includes(`'${key.replace(/'/g, "\\'")}':`))
        problems.push(`"${key}": already in ${l}.js`)
    }
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1) }

  for (const l of LANGS) {
    const lines = Object.entries(batch).map(([k, tr]) => entry(k, tr[l])).join('')
    fs.writeFileSync(path.join(dir, l + '.js'), insertInto(sources[l], l, lines, section))
  }
  console.log(`added ${Object.keys(batch).length} string(s) to ${LANGS.length} locale packs`)
}

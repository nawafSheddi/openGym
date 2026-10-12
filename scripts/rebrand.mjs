#!/usr/bin/env node
// One-shot (and re-runnable) brand rename: openGym → openBody.
//
//   node scripts/rebrand.mjs <path> [<path> …]        rewrite files in place
//   node scripts/rebrand.mjs --dry <path> [<path> …]  only report what would change
//
// Why a script and not a find-and-replace in an editor: openBody is a divergent fork, and an
// upstream fix that gets cherry-picked later arrives with the old name in it. Re-running this
// over the touched paths brings it in line without anyone having to remember the exceptions.
//
// What is deliberately NOT renamed:
//   · links to the upstream project (github.com/DuarteSantos8/openGym) — they credit the origin
//     and must keep pointing at it;
//   · lowercase `opengym` and `OPENGYM_*` — internal identifiers (log tags, env vars, plugin
//     names) that no user sees and that real deployments' config may already depend on. The
//     match below is case-sensitive, so they are skipped by construction;
//   · licence / history files (CHANGELOG, NOTICE, LICENSE, CLA) — they describe openGym's past
//     and its third-party terms, and rewriting them would misstate both.
import fs from 'node:fs'
import path from 'node:path'

const FROM = 'openGym'
const TO = 'openBody'

// Substrings that contain FROM but must survive verbatim. Each is swapped for a placeholder
// before the rename and restored after, so a plain global replace cannot touch them.
const PROTECTED = ['DuarteSantos8/openGym']

// Directories never worth walking (dependencies, build output, licensed media).
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'media', 'android', 'ios'])
// Files that document upstream's history or licences (see header).
const SKIP_FILES = new Set(['CHANGELOG.md', 'NOTICE.md', 'LICENSE', 'CLA.md'])
// Only text formats we know how to edit safely; everything else (images, archives) is left alone.
const TEXT_EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.yaml', '.yml', '.txt', '.webmanifest'])

/** Rename every unprotected occurrence of FROM in `text`. Pure, exported for testing. */
export function rebrandText(text) {
  let out = text
  // Park protected substrings behind NUL-delimited tokens that cannot occur in source text.
  PROTECTED.forEach((p, i) => { out = out.split(p).join(`\u0000${i}\u0000`) })
  out = out.split(FROM).join(TO)
  PROTECTED.forEach((p, i) => { out = out.split(`\u0000${i}\u0000`).join(p) })
  return out
}

/** Yield every editable file under `p` (a file or a directory). */
function* walk(p) {
  const st = fs.statSync(p)
  if (st.isFile()) { yield p; return }
  for (const name of fs.readdirSync(p)) {
    if (SKIP_DIRS.has(name)) continue
    yield* walk(path.join(p, name))
  }
}

// Only run the CLI when executed directly, so tests can import rebrandText without side effects.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const dry = args[0] === '--dry'
  const roots = dry ? args.slice(1) : args
  if (!roots.length) { console.error('usage: node scripts/rebrand.mjs [--dry] <path>…'); process.exit(2) }
  let files = 0, hits = 0
  for (const root of roots) {
    for (const file of walk(root)) {
      if (SKIP_FILES.has(path.basename(file)) || !TEXT_EXT.has(path.extname(file))) continue
      const before = fs.readFileSync(file, 'utf8')
      const after = rebrandText(before)
      if (after === before) continue
      // Count what actually changed (protected occurrences are not counted).
      const n = before.split(FROM).length - after.split(FROM).length
      files++; hits += n
      console.log(`${String(n).padStart(4)}  ${file}`)
      if (!dry) fs.writeFileSync(file, after)
    }
  }
  console.log(`${dry ? 'would change' : 'changed'} ${hits} occurrence(s) in ${files} file(s)`)
}

// Which picture an exercise row points at (EXDB `img` / `gif`), decided by what files exist.
//
// Three cases, in order:
//   1. Licensed media (catalogue/media/still/<id>.webp + clip/<id>.mp4, Gym visual, openGym's
//      licence): the still and the looping clip, exactly as upstream shipped them.
//   2. Open media (catalogue/media-open/<id>.svg|png|jpg|webp, credited in SOURCES.md): one still
//      image. It fills both fields: components/Media.jsx renders a non-video "clip" as an <img>,
//      and the server exposes media-open/ under both exercise-media/still/ and /clip/.
//   3. Nothing: empty fields. Media.jsx then renders no media block at all (the card closes up, as
//      for "animations off") instead of a broken-image tile for a file that was never there.
//
// Pure: callers pass in what exists, so this is testable without the 215 MB media folder.

// Preferred order when several open files exist for one id (vector first: sharp at any size).
export const OPEN_EXTS = ['svg', 'webp', 'png', 'jpg']

/**
 * @param {string} id                 exercise id
 * @param {Set<string>} licensedStills ids that have catalogue/media/still/<id>.webp
 * @param {Map<string,string>} openFiles  id → file name in catalogue/media-open/
 * @returns {{img: string, gif: string}}
 */
export function mediaFields(id, licensedStills, openFiles) {
  if (licensedStills.has(id)) return { img: id + '.webp', gif: id + '.mp4' }
  const open = openFiles.get(id)
  if (open) return { img: open, gif: open }
  return { img: '', gif: '' }
}

/** Index a directory listing of catalogue/media-open/ into id → best file (see OPEN_EXTS). */
export function indexOpenFiles(names) {
  const best = new Map()
  for (const n of names) {
    const m = /^(\d{4,5})\.(svg|webp|png|jpg)$/.exec(n)
    if (!m) continue
    const [, id, ext] = m
    const cur = best.get(id)
    if (!cur || OPEN_EXTS.indexOf(ext) < OPEN_EXTS.indexOf(cur.split('.')[1])) best.set(id, n)
  }
  return best
}

/**
 * Problems that make an SVG unsafe to serve from the app's own origin: anything that can run
 * script or pull in outside content. An exercise picture needs none of it (code review,
 * 2026-10-13: an SVG opened directly would run with the app's localStorage). [] = safe.
 */
export function svgProblems(text) {
  const p = []
  if (/<script\b/i.test(text)) p.push('<script>')
  if (/\son[a-z]+\s*=/i.test(text)) p.push('event-handler attribute (on…=)')
  if (/javascript:/i.test(text)) p.push('javascript: URL')
  if (/<foreignObject\b/i.test(text)) p.push('<foreignObject>')
  if (/<(iframe|embed|object)\b/i.test(text)) p.push('embedded document')
  // only in-document references (#id) and data: images; no external or relative files
  if (/\b(?:xlink:)?href\s*=\s*["'](?!#|data:image\/)/i.test(text)) p.push('external href')
  if (/@import|url\(\s*["']?(?!#|data:)/i.test(text)) p.push('external CSS reference')
  return p
}

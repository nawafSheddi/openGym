// Run: node --test scripts/catalogue/media-fields.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaFields, indexOpenFiles, svgProblems } from './media-fields.mjs'

const licensed = new Set(['0025'])

test('licensed media keeps the still and the mp4 clip', () => {
  assert.deepEqual(mediaFields('0025', licensed, new Map()), { img: '0025.webp', gif: '0025.mp4' })
})

test('licensed media wins over an open file for the same id', () => {
  assert.deepEqual(mediaFields('0025', licensed, new Map([['0025', '0025.svg']])), { img: '0025.webp', gif: '0025.mp4' })
})

test('open media fills both fields with the one still', () => {
  assert.deepEqual(mediaFields('20006', licensed, new Map([['20006', '20006.svg']])), { img: '20006.svg', gif: '20006.svg' })
})

test('no media gives empty fields (no broken tile in the app)', () => {
  assert.deepEqual(mediaFields('20099', licensed, new Map()), { img: '', gif: '' })
})

test('indexOpenFiles keeps image files only and prefers svg, then webp, png, jpg', () => {
  const m = indexOpenFiles(['20001.jpg', '20001.svg', '20002.png', '20002.webp', 'SOURCES.md', 'notes.txt', '20003.gif'])
  assert.equal(m.get('20001'), '20001.svg')
  assert.equal(m.get('20002'), '20002.webp')
  assert.equal(m.has('20003'), false)
  assert.equal(m.size, 2)
})

test('svgProblems passes a plain drawing and flags anything scriptable or external', () => {
  assert.deepEqual(svgProblems('<svg viewBox="0 0 360 360"><rect width="360" height="360" fill="#fff"/><path d="M1 1h4"/></svg>'), [])
  assert.ok(svgProblems('<svg><script>alert(1)</script></svg>').length)
  assert.ok(svgProblems('<svg onload="x()"></svg>').length)
  assert.ok(svgProblems('<svg><a href="javascript:x"/></svg>').length)
  assert.ok(svgProblems('<svg><foreignObject/></svg>').length)
  assert.ok(svgProblems('<svg><image href="https://evil.example/x.png"/></svg>').length)
  assert.deepEqual(svgProblems('<svg><use href="#a"/></svg>'), [])
})

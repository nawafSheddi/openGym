// Run: node --test scripts/catalogue/media-fields.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaFields, indexOpenFiles } from './media-fields.mjs'

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

// Tests for the openGym → openBody rename (scripts/rebrand.mjs).
// Run: node --test scripts/rebrand.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rebrandText } from './rebrand.mjs'

test('renames the brand in user-facing text', () => {
  assert.equal(rebrandText('Welcome to openGym!'), 'Welcome to openBody!')
  assert.equal(rebrandText("t('openGym backup')"), "t('openBody backup')")
})

test('keeps links to the upstream project pointing at upstream', () => {
  const s = 'Forked from https://github.com/DuarteSantos8/openGym (openGym)'
  assert.equal(rebrandText(s), 'Forked from https://github.com/DuarteSantos8/openGym (openBody)')
})

test('leaves lowercase identifiers and env vars alone', () => {
  // case-sensitive match: internal log tags and OPENGYM_UID must not change
  assert.equal(rebrandText('[opengym-mcp] set OPENGYM_UID'), '[opengym-mcp] set OPENGYM_UID')
})

test('is idempotent', () => {
  const once = rebrandText('openGym and openGym')
  assert.equal(rebrandText(once), once)
})

test('never renames the licensee in media licence statements', () => {
  assert.equal(rebrandText('licensed for use in openGym only'), 'licensed for use in openGym only')
  assert.equal(rebrandText('Pictures licensed to openGym by Gym visual'), 'Pictures licensed to openGym by Gym visual')
})

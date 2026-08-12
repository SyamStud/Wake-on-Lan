import test from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../src/db.js'
import { createDeviceStore } from '../src/device-store.js'
import { createApiKeyManager } from '../src/api-key.js'

function makeManager() {
  return createApiKeyManager(createDeviceStore(openDatabase(':memory:')))
}

test('api key: generate menghasilkan kunci valid, validate cocok', () => {
  const apiKey = makeManager()
  const key = apiKey.generate()
  assert.match(key, /^wol_[0-9a-f]{64}$/)
  assert.equal(apiKey.isActive(), true)
  assert.equal(apiKey.validate(key), true)
  assert.equal(apiKey.validate('wol_salah'), false)
  assert.equal(apiKey.validate(''), false)
  assert.equal(apiKey.validate(null), false)
})

test('api key: generate baru merevoke yang lama', () => {
  const apiKey = makeManager()
  const first = apiKey.generate()
  const second = apiKey.generate()
  assert.equal(apiKey.validate(first), false)
  assert.equal(apiKey.validate(second), true)
})

test('api key: revoke menonaktifkan', () => {
  const apiKey = makeManager()
  const key = apiKey.generate()
  apiKey.revoke()
  assert.equal(apiKey.isActive(), false)
  assert.equal(apiKey.validate(key), false)
})

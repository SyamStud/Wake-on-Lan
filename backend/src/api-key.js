import crypto from 'node:crypto'

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export function createApiKeyManager(store) {
  return {
    generate() {
      const key = `wol_${crypto.randomBytes(32).toString('hex')}`
      store.setApiKeyHash(hashKey(key))
      return key
    },

    validate(key) {
      if (!key) return false
      const stored = store.getApiKeyHash()
      if (!stored) return false
      const candidate = Buffer.from(hashKey(key))
      const expected = Buffer.from(stored)
      if (candidate.length !== expected.length) return false
      return crypto.timingSafeEqual(candidate, expected)
    },

    isActive() {
      return !!store.getApiKeyHash()
    },

    revoke() {
      store.clearApiKey()
    },
  }
}

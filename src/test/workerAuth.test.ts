// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { workerAuthorized } from '../../supabase/functions/_shared/worker-auth'

describe('private communications worker authentication', () => {
  it('accepts only the exact administrative credential without a Vault call', async () => {
    const rpc = vi.fn()
    expect(await workerAuthorized({ rpc }, 'known-service-key', 'known-service-key')).toBe(true)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects absent, malformed and forged role claims before database work', async () => {
    const rpc = vi.fn()
    for (const token of ['', 'wrong', 'é'.repeat(64), 'header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature']) {
      expect(await workerAuthorized({ rpc }, token, 'service')).toBe(false)
    }
    expect(rpc).not.toHaveBeenCalled()
  })
  it('passes only the digest of a Vault-format token and requires a true result', async () => {
    const token = 'a'.repeat(64)
    const rpc = vi.fn(async () => ({ data: true, error: null }))
    expect(await workerAuthorized({ rpc }, token, 'service')).toBe(true)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('verify_communications_worker', {
      p_token_hash: createHash('sha256').update(token).digest('hex'),
    })
  })
  it('fails closed on mismatch, lookup failure or thrown network error', async () => {
    for (const rpc of [async () => ({ data: false, error: null }), async () => ({ data: true, error: { message: 'failed' } }), async () => { throw new Error('network') }]) {
      expect(await workerAuthorized({ rpc }, 'a'.repeat(64), 'service')).toBe(false)
    }
  })
})

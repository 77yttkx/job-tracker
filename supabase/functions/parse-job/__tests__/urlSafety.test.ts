import { describe, expect, it } from 'vitest'
import { assertSafeUrl, isPrivateAddressLiteral } from '../urlSafety'

describe('isPrivateAddressLiteral', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    '127.5.5.5',
    '0.0.0.0',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata endpoint
    '::1',
    'metadata.google.internal',
  ])('flags %s as private', (host) => {
    expect(isPrivateAddressLiteral(host)).toBe(true)
  })

  it.each(['example.com', 'careers.moodys.com', 'boards.greenhouse.io', '8.8.8.8', '1.1.1.1'])(
    'does not flag %s as private',
    (host) => {
      expect(isPrivateAddressLiteral(host)).toBe(false)
    },
  )
})

describe('assertSafeUrl', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(assertSafeUrl(new URL('ftp://example.com'))).rejects.toThrow(/http and https/i)
    await expect(assertSafeUrl(new URL('file:///etc/passwd'))).rejects.toThrow(/http and https/i)
  })

  it('rejects localhost and loopback addresses', async () => {
    await expect(assertSafeUrl(new URL('http://localhost:3000/'))).rejects.toThrow()
    await expect(assertSafeUrl(new URL('http://127.0.0.1/'))).rejects.toThrow()
  })

  it('rejects private network ranges', async () => {
    await expect(assertSafeUrl(new URL('http://10.0.0.5/'))).rejects.toThrow()
    await expect(assertSafeUrl(new URL('http://192.168.1.1/'))).rejects.toThrow()
    await expect(assertSafeUrl(new URL('http://172.16.5.5/'))).rejects.toThrow()
  })

  it('rejects the cloud metadata address', async () => {
    await expect(assertSafeUrl(new URL('http://169.254.169.254/latest/meta-data/'))).rejects.toThrow()
  })

  it('allows an ordinary public https URL', async () => {
    await expect(assertSafeUrl(new URL('https://careers.moodys.com/en/job/1'))).resolves.toBeUndefined()
  })
})

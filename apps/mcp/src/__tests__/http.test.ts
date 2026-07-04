import { describe, expect, it } from 'vitest'
import { isBearerValid, isOriginAllowed } from '../http'

function headers(init: Record<string, string>): Headers {
  return new Headers(init)
}

describe('isOriginAllowed', () => {
  it('allows requests without an Origin header (non-browser clients)', () => {
    expect(isOriginAllowed(headers({}), [], [])).toBe(true)
  })

  it('rejects a request carrying a disallowed Origin', () => {
    expect(isOriginAllowed(headers({ origin: 'https://evil.example' }), [], [])).toBe(false)
  })

  it('allows an explicitly allowed Origin', () => {
    expect(isOriginAllowed(headers({ origin: 'https://ok.example' }), ['https://ok.example'], [])).toBe(true)
  })

  it('enforces the Host allowlist when configured', () => {
    expect(isOriginAllowed(headers({ host: 'evil.example' }), [], ['mcp.ttpos.dev'])).toBe(false)
    expect(isOriginAllowed(headers({ host: 'mcp.ttpos.dev' }), [], ['mcp.ttpos.dev'])).toBe(true)
  })

  it('skips Host checking when no allowlist is set', () => {
    expect(isOriginAllowed(headers({ host: 'anything.example' }), [], [])).toBe(true)
  })
})

describe('isBearerValid', () => {
  it('accepts the correct bearer token', () => {
    expect(isBearerValid(headers({ authorization: 'Bearer s3cret-token' }), 's3cret-token')).toBe(true)
  })

  it('rejects a wrong token', () => {
    expect(isBearerValid(headers({ authorization: 'Bearer nope' }), 's3cret-token')).toBe(false)
  })

  it('rejects a missing Authorization header', () => {
    expect(isBearerValid(headers({}), 's3cret-token')).toBe(false)
  })

  it('rejects a non-bearer scheme', () => {
    expect(isBearerValid(headers({ authorization: 's3cret-token' }), 's3cret-token')).toBe(false)
  })
})

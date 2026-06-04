import { describe, expect, it } from 'vitest'
import { parseConfig } from '../config'

describe('parseConfig', () => {
  it('parses token auth and trims a trailing slash', () => {
    const config = parseConfig({ API_BASE_URL: 'https://api.example.com/', API_TOKEN: 'abc' })
    expect(config.baseUrl).toBe('https://api.example.com')
    expect(config.authMode).toBe('token')
    expect(config.token).toBe('abc')
    expect(config.timeoutMs).toBe(15_000)
  })

  it('prefers token over username/password', () => {
    const config = parseConfig({
      API_BASE_URL: 'https://api.example.com',
      API_TOKEN: 'abc',
      API_USERNAME: 'u',
      API_PASSWORD: 'p',
    })
    expect(config.authMode).toBe('token')
  })

  it('parses login auth when username and password are present', () => {
    const config = parseConfig({ API_BASE_URL: 'https://api.example.com', API_USERNAME: 'u', API_PASSWORD: 'p' })
    expect(config.authMode).toBe('login')
  })

  it('falls back to none auth without credentials', () => {
    const config = parseConfig({ API_BASE_URL: 'https://api.example.com' })
    expect(config.authMode).toBe('none')
  })

  it('coerces the timeout to a number', () => {
    const config = parseConfig({ API_BASE_URL: 'https://api.example.com', API_TIMEOUT_MS: '5000' })
    expect(config.timeoutMs).toBe(5000)
  })

  it('rejects a missing base url', () => {
    expect(() => parseConfig({})).toThrow()
  })

  it('rejects an invalid base url', () => {
    expect(() => parseConfig({ API_BASE_URL: 'not-a-url' })).toThrow()
  })

  it('treats empty / whitespace env vars as absent (no crash)', () => {
    const config = parseConfig({
      API_BASE_URL: 'https://api.example.com',
      API_TOKEN: '',
      API_USERNAME: '   ',
      API_PASSWORD: '',
      API_TIMEOUT_MS: '',
    })
    expect(config.authMode).toBe('none')
    expect(config.token).toBeUndefined()
    expect(config.username).toBeUndefined()
    expect(config.timeoutMs).toBe(15_000)
  })

  it('rejects a non-numeric timeout', () => {
    expect(() => parseConfig({ API_BASE_URL: 'https://api.example.com', API_TIMEOUT_MS: 'abc' })).toThrow()
  })
})

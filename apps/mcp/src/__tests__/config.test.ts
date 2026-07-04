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

  it('defaults the transport to stdio with no http config', () => {
    const config = parseConfig({ API_BASE_URL: 'https://api.example.com' })
    expect(config.transport).toBe('stdio')
    expect(config.http).toBeUndefined()
  })

  it('requires MCP_HTTP_AUTH_TOKEN in http mode', () => {
    expect(() => parseConfig({ API_BASE_URL: 'https://api.example.com', MCP_TRANSPORT: 'http' })).toThrow(/MCP_HTTP_AUTH_TOKEN/)
    // empty token counts as absent and must also be rejected
    expect(() => parseConfig({ API_BASE_URL: 'https://api.example.com', MCP_TRANSPORT: 'http', MCP_HTTP_AUTH_TOKEN: '' })).toThrow(/MCP_HTTP_AUTH_TOKEN/)
  })

  it('parses http config with secure defaults', () => {
    const config = parseConfig({
      API_BASE_URL: 'https://api.example.com',
      MCP_TRANSPORT: 'http',
      MCP_HTTP_AUTH_TOKEN: 'client-secret',
    })
    expect(config.transport).toBe('http')
    expect(config.http).toEqual({
      host: '127.0.0.1',
      port: 3010,
      authToken: 'client-secret',
      allowedHosts: [],
      allowedOrigins: [],
    })
  })

  it('parses host, port and comma-separated allowlists', () => {
    const config = parseConfig({
      API_BASE_URL: 'https://api.example.com',
      MCP_TRANSPORT: 'http',
      MCP_HTTP_AUTH_TOKEN: 'client-secret',
      MCP_HTTP_HOST: '0.0.0.0',
      MCP_HTTP_PORT: '8080',
      MCP_ALLOWED_HOSTS: 'mcp.ttpos.dev, localhost',
      MCP_ALLOWED_ORIGINS: 'https://app.example',
    })
    expect(config.http?.host).toBe('0.0.0.0')
    expect(config.http?.port).toBe(8080)
    expect(config.http?.allowedHosts).toEqual(['mcp.ttpos.dev', 'localhost'])
    expect(config.http?.allowedOrigins).toEqual(['https://app.example'])
  })
})

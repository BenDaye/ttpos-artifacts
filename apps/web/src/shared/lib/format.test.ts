import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from './format'

describe('formatDateTime', () => {
  it('returns empty string for nullish and empty input', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime('')).toBe('')
  })

  it('returns empty string for an unparseable value', () => {
    expect(formatDateTime('not-a-date')).toBe('')
    expect(formatDateTime(Number.NaN)).toBe('')
  })

  it('formats a Date instance via toLocaleString', () => {
    const d = new Date(Date.UTC(2024, 0, 2, 3, 4, 5))
    expect(formatDateTime(d)).toBe(d.toLocaleString())
    expect(formatDateTime(d)).not.toBe('')
  })

  it('parses string and numeric inputs the same as the equivalent Date', () => {
    const d = new Date(Date.UTC(2024, 0, 2, 3, 4, 5))
    expect(formatDateTime(d.getTime())).toBe(d.toLocaleString())
    expect(formatDateTime(d.toISOString())).toBe(d.toLocaleString())
  })
})

describe('formatDate', () => {
  it('returns empty string for nullish, empty and invalid input', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('')).toBe('')
    expect(formatDate('nope')).toBe('')
  })

  it('formats a Date (and equivalent timestamp) via toLocaleDateString', () => {
    const d = new Date(Date.UTC(2024, 5, 15, 12, 0, 0))
    expect(formatDate(d)).toBe(d.toLocaleDateString())
    expect(formatDate(d.getTime())).toBe(d.toLocaleDateString())
  })
})

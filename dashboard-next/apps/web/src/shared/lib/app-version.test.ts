import { describe, expect, it } from 'vitest'
import { formatBuildTooltip, formatVersionLabel } from './app-version'

describe('formatVersionLabel', () => {
  it('给裸版本号补 v 前缀', () => {
    expect(formatVersionLabel('0.1.0')).toBe('v0.1.0')
  })

  it('已带 v 前缀时不重复添加', () => {
    expect(formatVersionLabel('v1.2.3')).toBe('v1.2.3')
  })

  it('空值或 unknown 回退为 vunknown', () => {
    expect(formatVersionLabel('')).toBe('vunknown')
    expect(formatVersionLabel('unknown')).toBe('vunknown')
  })
})

describe('formatBuildTooltip', () => {
  it('版本、commit、构建时间齐全时用 · 连接', () => {
    const tooltip = formatBuildTooltip({
      version: '0.1.0',
      commit: 'abc1234',
      builtAt: '2026-06-02T00:00:00.000Z',
    })
    expect(tooltip.startsWith('v0.1.0 · abc1234 · ')).toBe(true)
  })

  it('commit 为 unknown 时省略 commit 段', () => {
    expect(formatBuildTooltip({
      version: '0.1.0',
      commit: 'unknown',
      builtAt: 'unknown',
    })).toBe('v0.1.0')
  })

  it('构建时间非法时原样保留', () => {
    expect(formatBuildTooltip({
      version: '0.1.0',
      commit: 'unknown',
      builtAt: 'not-a-date',
    })).toBe('v0.1.0 · not-a-date')
  })
})

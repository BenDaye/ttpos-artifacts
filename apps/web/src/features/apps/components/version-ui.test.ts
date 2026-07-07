import type { AppVersion, ChangelogEntry } from '@ttpos/shared'
import { describe, expect, it } from 'vitest'
import { changelogTextForVersion, sortVersionsByChannel } from './version-ui'

function makeVersion(version: string, channel: string): AppVersion {
  return {
    ID: `${version}-${channel}`,
    AppName: 'demo',
    Version: version,
    Channel: channel,
    Published: true,
    Critical: false,
    Intermediate: false,
    Artifacts: [],
    Changelog: [],
    Updated_at: '2025-01-01T00:00:00Z',
  }
}

const label = (v: AppVersion) => `${v.Version}/${v.Channel}`

function withChangelog(version: string, changelog: ChangelogEntry[]): AppVersion {
  return { ...makeVersion(version, 'prod'), Changelog: changelog }
}

describe('changelogTextForVersion', () => {
  it('只返回当前版本那条的纯 Changes，不带 ## 版本 — 日期 标题', () => {
    const v = withChangelog('1.0.0', [
      { Version: '1.0.0', Date: '2026-01-01', Changes: '首次发布' },
    ])
    expect(changelogTextForVersion(v)).toBe('首次发布')
  })

  it('多条 changelog 时只取匹配当前版本的那条', () => {
    const v = withChangelog('2.0.0', [
      { Version: '1.0.0', Date: '2026-01-01', Changes: '旧版本' },
      { Version: '2.0.0', Date: '2026-02-01', Changes: '当前版本改动' },
    ])
    expect(changelogTextForVersion(v)).toBe('当前版本改动')
  })

  it('往返幂等：seed 出的文本原样回写后再 seed 不累积标题（复现 bug 的核心）', () => {
    const v = withChangelog('1.0.0', [
      { Version: '1.0.0', Date: '2026-01-01', Changes: '内容' },
    ])
    const seeded = changelogTextForVersion(v)
    // 模拟后端把提交文本覆盖进同版本那条的 Changes 后，再次打开编辑
    const afterSave = withChangelog('1.0.0', [
      { Version: '1.0.0', Date: '2026-02-02', Changes: seeded },
    ])
    expect(changelogTextForVersion(afterSave)).toBe('内容')
  })

  it('找不到匹配版本时返回空串', () => {
    const v = withChangelog('3.0.0', [
      { Version: '1.0.0', Date: '2026-01-01', Changes: '别的版本' },
    ])
    expect(changelogTextForVersion(v)).toBe('')
  })

  it('无 changelog 时返回空串', () => {
    expect(changelogTextForVersion(makeVersion('1.0.0', 'prod'))).toBe('')
  })
})

describe('sortVersionsByChannel', () => {
  it('同一 version 号内按 channel 列表顺序排列，即便列表顺序非字母序', () => {
    const input = [
      makeVersion('2.0.0', 'dev'),
      makeVersion('2.0.0', 'prod'),
      makeVersion('2.0.0', 'test'),
    ]
    // channel 列表顺序（位次）为 prod, test, dev —— 创建序，非字母序
    const channelOrder = new Map([['prod', 0], ['test', 1], ['dev', 2]])

    // 跟随 channel 列表顺序而非字母序（字母序会是 dev, prod, test）
    expect(sortVersionsByChannel(input, channelOrder).map(label)).toEqual([
      '2.0.0/prod',
      '2.0.0/test',
      '2.0.0/dev',
    ])
  })

  it('保留后端的版本号块顺序，只在块内按 channel 重排', () => {
    const input = [
      makeVersion('2.0.0', 'dev'),
      makeVersion('2.0.0', 'prod'),
      makeVersion('1.0.0', 'test'),
      makeVersion('1.0.0', 'prod'),
    ]
    const channelOrder = new Map([['prod', 0], ['test', 1], ['dev', 2]])

    expect(sortVersionsByChannel(input, channelOrder).map(label)).toEqual([
      '2.0.0/prod',
      '2.0.0/dev',
      '1.0.0/prod',
      '1.0.0/test',
    ])
  })

  it('channel 不在列表中时排到已知 channel 之后', () => {
    const input = [
      makeVersion('1.0.0', 'beta'),
      makeVersion('1.0.0', 'prod'),
    ]
    const channelOrder = new Map([['prod', 0]])

    expect(sortVersionsByChannel(input, channelOrder).map(label)).toEqual([
      '1.0.0/prod',
      '1.0.0/beta',
    ])
  })

  it('channel 都不在列表中时按 channel 名稳定收敛', () => {
    const input = [
      makeVersion('1.0.0', 'zeta'),
      makeVersion('1.0.0', 'alpha'),
    ]

    expect(sortVersionsByChannel(input, new Map()).map(label)).toEqual([
      '1.0.0/alpha',
      '1.0.0/zeta',
    ])
  })

  it('不修改入参并返回新数组', () => {
    const input = [
      makeVersion('1.0.0', 'test'),
      makeVersion('1.0.0', 'prod'),
    ]
    const snapshot = input.map(label)
    const result = sortVersionsByChannel(input, new Map([['prod', 0], ['test', 1]]))

    expect(result).not.toBe(input)
    expect(input.map(label)).toEqual(snapshot)
  })
})

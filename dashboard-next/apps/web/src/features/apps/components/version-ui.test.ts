import type { AppVersion } from '@ttpos/shared'
import { describe, expect, it } from 'vitest'
import { sortVersionsByChannel } from './version-ui'

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

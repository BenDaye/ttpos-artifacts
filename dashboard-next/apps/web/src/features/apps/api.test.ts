import { describe, expect, it } from 'vitest'
import { buildDeleteArtifactPayload } from './api'

describe('buildDeleteArtifactPayload', () => {
  it('artifact_links 使用 artifact 的稳定 link(而非位次或包名)', () => {
    const link = 'https://cdn.example.com/download?key=MyApp-owner/stable/darwin/arm64/MyApp-1.2.3.dmg'
    const payload = buildDeleteArtifactPayload('64f0abc', 'MyApp', '1.2.3', link)
    expect(payload).toEqual({
      id: '64f0abc',
      app_name: 'MyApp',
      version: '1.2.3',
      artifact_links: [link],
    })
    // 回归守卫:后端按 link 稳定标识删除,既不能退回发位次下标(纯数字),
    // 也不能发包名。原样发送收到的 link 才能与后端存储精确匹配。
    expect(payload.artifact_links[0]).toBe(link)
    expect(payload.artifact_links[0]).not.toMatch(/^\d+$/)
  })
})

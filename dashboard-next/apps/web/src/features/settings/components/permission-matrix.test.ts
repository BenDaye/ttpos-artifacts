import type { TeamUserPermissions } from '@ttpos/shared'
import { describe, expect, it } from 'vitest'
import { makeEmptyPermissions, normalizePermissions } from './permission-matrix'

describe('makeEmptyPermissions', () => {
  it('为每个分组创建独立的 Allowed 数组引用', () => {
    const perms = makeEmptyPermissions()
    perms.Apps.Allowed.push('a')
    expect(perms.Channels.Allowed).toEqual([])
    expect(perms.Platforms.Allowed).toEqual([])
    expect(perms.Archs.Allowed).toEqual([])
  })
})

describe('normalizePermissions', () => {
  it('当 perms 为 null/undefined 时返回完整空结构', () => {
    expect(normalizePermissions(null)).toEqual(makeEmptyPermissions())
    expect(normalizePermissions(undefined)).toEqual(makeEmptyPermissions())
  })

  it('将后端返回的 null Allowed 字段归一化为空数组（修复 .includes 报错）', () => {
    const fromBackend = {
      Apps: { Create: true, Delete: false, Edit: false, Download: false, Upload: false, Allowed: null },
      Channels: { Create: false, Delete: false, Edit: true, Allowed: null },
      Platforms: { Create: false, Delete: false, Edit: false, Allowed: null },
      Archs: { Create: false, Delete: false, Edit: false, Allowed: null },
    } as unknown as TeamUserPermissions

    const result = normalizePermissions(fromBackend)
    expect(result.Apps.Allowed).toEqual([])
    expect(result.Channels.Allowed).toEqual([])
    expect(result.Platforms.Allowed).toEqual([])
    expect(result.Archs.Allowed).toEqual([])
    expect(result.Apps.Create).toBe(true)
    expect(result.Channels.Edit).toBe(true)
  })

  it('保留已有的 Allowed 数据', () => {
    const fromBackend: TeamUserPermissions = {
      Apps: { Create: false, Delete: false, Edit: false, Download: false, Upload: false, Allowed: ['app-1'] },
      Channels: { Create: false, Delete: false, Edit: false, Allowed: ['stable'] },
      Platforms: { Create: false, Delete: false, Edit: false, Allowed: [] },
      Archs: { Create: false, Delete: false, Edit: false, Allowed: ['amd64'] },
    }
    const result = normalizePermissions(fromBackend)
    expect(result.Apps.Allowed).toEqual(['app-1'])
    expect(result.Channels.Allowed).toEqual(['stable'])
    expect(result.Archs.Allowed).toEqual(['amd64'])
  })
})

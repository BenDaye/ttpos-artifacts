import type { TeamUserPermissions } from '@ttpos/shared'
import { describe, expect, it } from 'vitest'
import { coerceAllowedValuesToIds, makeEmptyPermissions, normalizePermissions } from './permission-matrix'

describe('makeEmptyPermissions', () => {
  it('creates independent Allowed arrays for each group', () => {
    const perms = makeEmptyPermissions()
    perms.Apps.Allowed.push('a')
    expect(perms.Channels.Allowed).toEqual([])
    expect(perms.Platforms.Allowed).toEqual([])
    expect(perms.Archs.Allowed).toEqual([])
  })
})

describe('normalizePermissions', () => {
  it('returns a complete empty structure for null or undefined permissions', () => {
    expect(normalizePermissions(null)).toEqual(makeEmptyPermissions())
    expect(normalizePermissions(undefined)).toEqual(makeEmptyPermissions())
  })

  it('normalizes null Allowed fields from the backend to empty arrays', () => {
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

  it('preserves existing Allowed data', () => {
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

describe('coerceAllowedValuesToIds', () => {
  it('converts legacy display names to IDs before saving permissions', () => {
    const result = coerceAllowedValuesToIds(
      ['Cashier', 'bbbbbbbbbbbbbbbbbbbbbbbb', 'unknown'],
      [
        { value: 'aaaaaaaaaaaaaaaaaaaaaaaa', label: 'Cashier' },
        { value: 'bbbbbbbbbbbbbbbbbbbbbbbb', label: 'KDS' },
      ],
    )

    expect(result).toEqual(['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb', 'unknown'])
  })
})

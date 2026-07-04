import { describe, expect, it } from 'vitest'
import { getDefaultUpdaterType, getUpdaterLabel, normalizeUpdaters } from './updaters'

describe('normalizeUpdaters', () => {
  it('adds manual as the default updater when the input is empty', () => {
    expect(normalizeUpdaters()).toEqual([{ type: 'manual', default: true }])
  })

  it('keeps exactly one default updater', () => {
    const result = normalizeUpdaters([
      { type: 'manual', default: true },
      { type: 'tauri', default: true },
    ])

    expect(result.filter(updater => updater.default)).toHaveLength(1)
    expect(getDefaultUpdaterType(result)).toBe('manual')
  })

  it('maps known updater types to display labels', () => {
    expect(getUpdaterLabel('electron-builder')).toBe('Electron Builder')
    expect(getUpdaterLabel('custom')).toBe('custom')
  })
})

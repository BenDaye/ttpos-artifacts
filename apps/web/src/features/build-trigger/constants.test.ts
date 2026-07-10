import { describe, expect, it } from 'vitest'
import { appDisplayName, packageAlias, platformLabel } from './constants'

describe('build trigger labels', () => {
  it('uses published short-link style aliases for package ids', () => {
    expect(packageAlias('pos')).toBe('cashier')
    expect(packageAlias('assistant')).toBe('assistant')
    expect(packageAlias('kds')).toBe('kitchen')
    expect(packageAlias('tablet')).toBe('menu')
    expect(packageAlias('shop')).toBe('shop')
  })

  it('shows the server-provided FaynoSync app name first', () => {
    expect(appDisplayName('TTPOS Go', 'assistant')).toBe('TTPOS Go')
    expect(appDisplayName('', 'pos')).toBe('cashier')
  })

  it('keeps platform display labels stable', () => {
    expect(platformLabel('ios')).toBe('iOS')
    expect(platformLabel('android')).toBe('Android')
  })
})

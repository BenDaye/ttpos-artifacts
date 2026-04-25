import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges tailwind classes deduping conflicting utilities', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('keeps non-conflicting classes intact', () => {
    expect(cn('flex', 'items-center', false && 'hidden')).toBe('flex items-center')
  })
})

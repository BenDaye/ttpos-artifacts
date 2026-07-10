import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TriggerBuildDialog } from './trigger-build-dialog'

vi.mock('react-i18next', () => ({
  // eslint-disable-next-line react/component-hook-factories -- test stub exports a hook
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}))

/* eslint-disable react/component-hook-factories -- test stubs export hook-shaped functions */
vi.mock('../hooks', () => ({
  useCapabilities: () => ({
    data: {
      platforms: ['android', 'ios'],
      packages: [
        { package: 'pos', app_name: 'TTPOS', platforms: ['android', 'ios'] },
        { package: 'assistant', app_name: 'TTPOS Go', platforms: ['android', 'ios'] },
        { package: 'kds', app_name: 'TTPOS Kitchen', platforms: ['android', 'ios'] },
        { package: 'tablet', app_name: 'TTPOS Menu', platforms: ['android', 'ios'] },
      ],
    },
    isLoading: false,
  }),
  useTriggerBuild: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}))
/* eslint-enable react/component-hook-factories */

describe('trigger build dialog app cards', () => {
  it('renders app cards from capabilities names and short-link style aliases', () => {
    render(
      <TriggerBuildDialog
        open
        onOpenChange={vi.fn()}
        onBuildTriggered={vi.fn()}
      />,
    )

    expect(screen.getByText('TTPOS Go')).toBeInTheDocument()
    expect(screen.getByText('cashier / pos')).toBeInTheDocument()
    expect(screen.getByText('kitchen / kds')).toBeInTheDocument()
    expect(screen.getByText('menu / tablet')).toBeInTheDocument()
    expect(screen.queryByText('助手')).not.toBeInTheDocument()
    expect(screen.queryByText('菜牌')).not.toBeInTheDocument()

    const cardGrid = screen.getByText('TTPOS Go').closest('label')?.parentElement
    expect(cardGrid).toHaveClass('grid-cols-2')
    expect(cardGrid).not.toHaveClass('sm:grid-cols-3')
  })
})

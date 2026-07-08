import type { LayoutMode } from '@ttpos/shared'
import { ColumnsIcon, ListIcon, SquaresFourIcon } from '@phosphor-icons/react'
import { ToggleGroup, ToggleGroupItem } from '@ttpos/ui/components/toggle-group'
import { cn } from '@ttpos/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '@/shared/stores/ui-store'

const ITEMS: { value: LayoutMode, icon: typeof SquaresFourIcon, labelKey: string }[] = [
  { value: 'card', icon: SquaresFourIcon, labelKey: 'layout.card' },
  { value: 'list', icon: ListIcon, labelKey: 'layout.list' },
  { value: 'board', icon: ColumnsIcon, labelKey: 'layout.board' },
]

export function LayoutSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const layout = useUiStore(s => s.layout)
  const setLayout = useUiStore(s => s.setLayout)
  return (
    <ToggleGroup className={cn('shrink-0', className)} data-testid="layout-switcher">
      {ITEMS.map(({ value, icon: Icon, labelKey }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-pressed={layout === value}
          data-pressed={layout === value}
          aria-label={t(labelKey)}
          onClick={() => setLayout(value)}
        >
          <Icon className="size-4" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

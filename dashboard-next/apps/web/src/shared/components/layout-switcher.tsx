import type { LayoutMode } from '@ttpos/shared'
import { Columns, LayoutGrid, List as ListIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { useUiStore } from '@/shared/stores/ui-store'

const ITEMS: { value: LayoutMode, icon: typeof LayoutGrid, labelKey: string }[] = [
  { value: 'card', icon: LayoutGrid, labelKey: 'layout.card' },
  { value: 'list', icon: ListIcon, labelKey: 'layout.list' },
  { value: 'board', icon: Columns, labelKey: 'layout.board' },
]

export function LayoutSwitcher() {
  const { t } = useTranslation('common')
  const layout = useUiStore(s => s.layout)
  const setLayout = useUiStore(s => s.setLayout)
  return (
    <ToggleGroup>
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

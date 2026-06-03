import type { AppSummary } from '@ttpos/shared'
import type { AppViewProps } from './types'
import type { SortableItemRenderProps } from '@/shared/components/common/sortable-list'
import { verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Boxes, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SortableList } from '@/shared/components/common/sortable-list'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { formatDateTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

export function AppListView({ apps, onSelect, onEdit, onDelete, onReorder, canReorder = false }: AppViewProps) {
  const { t } = useTranslation(['apps', 'common'])
  // 仅当存在重排回调且当前允许时才启用拖拽
  const reorderEnabled = canReorder && Boolean(onReorder)

  const renderRow = (app: AppSummary, sortable?: SortableItemRenderProps) => (
    <div
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(app)}
      onKeyDown={(e) => {
        // 仅响应聚焦在行本身时的按键;来自子元素(拖拽手柄、编辑/删除按钮)的事件放行,
        // 避免抢占 dnd-kit 手柄的 Space 键盘拖拽与按钮自身的激活。
        if (e.currentTarget !== e.target) {
          return
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(app)
        }
      }}
      className={cn(
        'app-list-row-grid grid min-w-0 cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-accent/50 active:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:items-center',
        sortable?.isDragging && 'bg-accent/50 opacity-50',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {reorderEnabled && sortable && (
          <button
            type="button"
            aria-label={t('reorder', { defaultValue: 'Drag to reorder' })}
            className="shrink-0 cursor-grab touch-none text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            onClick={e => e.stopPropagation()}
            {...sortable.handleProps}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          {app.Logo
            ? <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
            : <Boxes className="size-3.5" />}
        </div>
        <span className="truncate text-sm font-medium" title={app.AppName}>{app.AppName}</span>
      </div>
      <div className="hidden truncate text-xs text-muted-foreground sm:block">{app.Description || '—'}</div>
      <div className="hidden text-xs text-muted-foreground sm:block">{formatDateTime(app.Updated_at) || '—'}</div>
      <div className="flex shrink-0 items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('common:actions.edit')}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(app)
          }}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('common:actions.delete')}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(app)
          }}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  )

  return (
    <Card className="max-w-full overflow-hidden">
      <div className="divide-y divide-border">
        <div aria-hidden className="app-list-header-grid hidden bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:gap-3">
          <div>{t('list.name', { defaultValue: 'Name' })}</div>
          <div>{t('list.description', { defaultValue: 'Description' })}</div>
          <div>{t('updated_at')}</div>
          <div className="text-right">{t('list.actions', { defaultValue: 'Actions' })}</div>
        </div>
        {reorderEnabled
          ? (
              <SortableList
                ids={apps.map(app => app.ID)}
                onReorder={ids => onReorder?.(ids)}
                strategy={verticalListSortingStrategy}
                className="divide-y divide-border"
                renderItem={(id, sortable) => {
                  const app = apps.find(item => item.ID === id)
                  if (!app) {
                    return null
                  }
                  return renderRow(app, sortable)
                }}
              />
            )
          : apps.map(app => <div key={app.ID}>{renderRow(app)}</div>)}
      </div>
    </Card>
  )
}

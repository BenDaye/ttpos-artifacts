import type { AppSummary } from '@ttpos/shared'
import type { AppViewProps } from './types'
import type { SortableItemRenderProps } from '@/shared/components/common/sortable-list'
import { Button } from '@ttpos/ui/components/button'
import { Card, CardContent } from '@ttpos/ui/components/card'
import { cn } from '@ttpos/ui/lib/utils'
import { Boxes, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SortableList } from '@/shared/components/common/sortable-list'
import { formatDateTime } from '@/shared/lib/format'

export function AppCardView({ apps, onSelect, onEdit, onDelete, onReorder, canReorder = false }: AppViewProps) {
  const { t } = useTranslation(['apps', 'common'])
  // 仅当存在重排回调且当前允许时才启用拖拽
  const reorderEnabled = canReorder && Boolean(onReorder)

  const renderCard = (app: AppSummary, sortable?: SortableItemRenderProps) => (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(app)}
      onKeyDown={(e) => {
        // 仅响应聚焦在卡片本身时的按键；来自子元素（拖拽手柄、编辑/删除按钮）的事件放行，
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
        'cursor-pointer transition-colors hover:ring-foreground/30 hover:bg-accent/50 active:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        sortable?.isDragging && 'opacity-50',
      )}
    >
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
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
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              {app.Logo
                ? <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
                : <Boxes className="size-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" title={app.AppName}>{app.AppName}</p>
              {app.Description && (
                <p className="line-clamp-1 text-xs text-muted-foreground">{app.Description}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
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
        {formatDateTime(app.Updated_at) && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('updated_at', { defaultValue: 'Updated' })}
            {' '}
            {formatDateTime(app.Updated_at)}
          </p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <SortableList
      ids={apps.map(app => app.ID)}
      onReorder={ids => onReorder?.(ids)}
      disabled={!reorderEnabled}
      className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      renderItem={(id, sortable) => {
        const app = apps.find(item => item.ID === id)
        if (!app) {
          return null
        }
        return (
          <div ref={sortable.setNodeRef} style={sortable.style} className="min-w-0">
            {renderCard(app, sortable)}
          </div>
        )
      }}
    />
  )
}

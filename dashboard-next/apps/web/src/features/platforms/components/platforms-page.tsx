import type { Platform } from '@ttpos/shared'
import { GripVertical, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { SortableList } from '@/shared/components/common/sortable-list'
import { EmptyState } from '@/shared/components/empty-state'
import { ErrorState } from '@/shared/components/error-state'
import { PageHeader } from '@/shared/components/page-header'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import {
  useDeletePlatformMutation,
  usePlatformsQuery,
  useReorderPlatformsMutation,
} from '../hooks'
import { PlatformFormDialog } from './platform-form-dialog'

export function PlatformsPage() {
  const { t } = useTranslation(['platforms', 'common'])
  const platformsQuery = usePlatformsQuery()
  const deleteMutation = useDeletePlatformMutation()
  const reorderMutation = useReorderPlatformsMutation()
  const [editing, setEditing] = useState<Platform | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Platform | null>(null)
  const [search, setSearch] = useState('')

  // 搜索过滤激活时禁用拖拽，避免在子集上重排破坏完整顺序
  const isFiltering = search.trim() !== ''

  const filteredPlatforms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return platformsQuery.data ?? []
    }
    return (platformsQuery.data ?? []).filter((platform) => {
      const updaterText = (platform.Updaters ?? []).map(updater => updater.type).join(' ')
      return `${platform.PlatformName} ${platform.ID} ${updaterText}`.toLowerCase().includes(q)
    })
  }, [platformsQuery.data, search])

  const onReorder = (ids: string[]) => {
    reorderMutation.mutate(ids, {
      onSuccess: () => {
        toast.success(t('reordered', { defaultValue: 'Order updated' }))
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : t('common:states.error')
        toast.error(message)
      },
    })
  }

  const onDelete = async () => {
    if (!deleting)
      return
    try {
      await deleteMutation.mutateAsync(deleting.ID)
      toast.success(t('deleted'))
      setDeleting(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  return (
    <div className="min-w-0 max-w-full">
      <PageHeader
        title={t('common:nav.platforms')}
        description={t('description')}
        actions={(
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t('common:actions.create')}
          </Button>
        )}
      />

      <div className="dashboard-search-shell mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common:actions.search')}
            className="pl-9"
          />
        </div>
      </div>

      {platformsQuery.isPending && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {platformsQuery.isError && (
        <ErrorState onRetry={() => platformsQuery.refetch()} />
      )}

      {platformsQuery.isSuccess && filteredPlatforms.length === 0 && (
        <EmptyState
          icon={Layers}
          title={t('empty.title')}
          description={t('empty.description')}
          action={(
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('common:actions.create')}
            </Button>
          )}
        />
      )}

      {platformsQuery.isSuccess && filteredPlatforms.length > 0 && (
        <SortableList
          ids={filteredPlatforms.map(platform => platform.ID)}
          onReorder={onReorder}
          disabled={isFiltering}
          className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          renderItem={(id, sortable) => {
            const platform = filteredPlatforms.find(item => item.ID === id)
            if (!platform) {
              return null
            }
            return (
              <div
                ref={sortable.setNodeRef}
                style={sortable.style}
                className={cn('min-w-0', sortable.isDragging && 'opacity-50')}
              >
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {!isFiltering && (
                        <button
                          type="button"
                          aria-label={t('reorder', { defaultValue: 'Drag to reorder' })}
                          className="shrink-0 cursor-grab touch-none text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                          {...sortable.handleProps}
                        >
                          <GripVertical className="size-4" />
                        </button>
                      )}
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <Layers className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{platform.PlatformName}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline">
                            {platform.ID.slice(0, 8)}
                          </Badge>
                          {(platform.Updaters ?? []).map(updater => (
                            <Badge key={updater.type} variant={updater.default ? 'secondary' : 'outline'}>
                              {updater.type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common:actions.edit')}
                        onClick={() => setEditing(platform)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common:actions.delete')}
                        onClick={() => setDeleting(platform)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          }}
        />
      )}

      <PlatformFormDialog open={creating} onOpenChange={setCreating} />
      <PlatformFormDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditing(null)}
        platform={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
        title={t('delete_title')}
        description={t('delete_description')}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}

import type { Architecture } from '@ttpos/shared'
import { Badge } from '@ttpos/ui/components/badge'
import { Button } from '@ttpos/ui/components/button'
import { Card, CardContent } from '@ttpos/ui/components/card'
import { Input } from '@ttpos/ui/components/input'
import { Skeleton } from '@ttpos/ui/components/skeleton'
import { cn } from '@ttpos/ui/lib/utils'
import { Cpu, GripVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { SortableList } from '@/shared/components/common/sortable-list'
import { EmptyState } from '@/shared/components/empty-state'
import { ErrorState } from '@/shared/components/error-state'
import { PageHeader } from '@/shared/components/page-header'
import {
  useArchitecturesQuery,
  useDeleteArchitectureMutation,
  useReorderArchitecturesMutation,
} from '../hooks'
import { ArchitectureFormDialog } from './architecture-form-dialog'

export function ArchitecturesPage() {
  const { t } = useTranslation(['architectures', 'common'])
  const archQuery = useArchitecturesQuery()
  const deleteMutation = useDeleteArchitectureMutation()
  const reorderMutation = useReorderArchitecturesMutation()
  const [editing, setEditing] = useState<Architecture | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Architecture | null>(null)
  const [search, setSearch] = useState('')

  // 搜索过滤激活时禁用拖拽，避免在子集上重排破坏完整顺序
  const isFiltering = search.trim() !== ''

  const filteredArchitectures = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return archQuery.data ?? []
    }
    return (archQuery.data ?? []).filter(arch =>
      `${arch.ArchID} ${arch.ID}`.toLowerCase().includes(q),
    )
  }, [archQuery.data, search])

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
        title={t('common:nav.architectures')}
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

      {archQuery.isPending && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {['sk-1', 'sk-2', 'sk-3', 'sk-4'].map(k => (
            <Skeleton key={k} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {archQuery.isError && (
        <ErrorState onRetry={() => archQuery.refetch()} />
      )}

      {archQuery.isSuccess && filteredArchitectures.length === 0 && (
        <EmptyState
          icon={Cpu}
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

      {archQuery.isSuccess && filteredArchitectures.length > 0 && (
        <SortableList
          ids={filteredArchitectures.map(arch => arch.ID)}
          onReorder={onReorder}
          disabled={isFiltering}
          className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          renderItem={(id, sortable) => {
            const arch = filteredArchitectures.find(item => item.ID === id)
            if (!arch) {
              return null
            }
            return (
              <div
                ref={sortable.setNodeRef}
                style={sortable.style}
                className={cn('min-w-0', sortable.isDragging && 'opacity-50')}
              >
                <Card>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {!isFiltering && (
                        <button
                          type="button"
                          aria-label={t('reorder', { defaultValue: 'Drag to reorder' })}
                          className="shrink-0 cursor-grab touch-none text-muted-foreground focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
                          {...sortable.handleProps}
                        >
                          <GripVertical className="size-4" />
                        </button>
                      )}
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <Cpu className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{arch.ArchID}</p>
                        <Badge variant="outline" className="mt-1">
                          {arch.ID.slice(0, 8)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common:actions.edit')}
                        onClick={() => setEditing(arch)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('common:actions.delete')}
                        onClick={() => setDeleting(arch)}
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

      <ArchitectureFormDialog open={creating} onOpenChange={setCreating} />
      <ArchitectureFormDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditing(null)}
        architecture={editing}
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

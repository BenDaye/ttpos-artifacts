import type { AppSummary } from '@ttpos/shared'
import { useNavigate } from '@tanstack/react-router'
import { Boxes, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { LayoutSwitcher } from '@/shared/components/layout-switcher'
import { PageHeader } from '@/shared/components/page-header'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/ui-store'
import { useAppsListQuery, useDeleteAppMutation } from '../hooks'
import { AppFormDialog } from './app-form-dialog'
import { AppBoardView } from './views/app-board-view'
import { AppCardView } from './views/app-card-view'
import { AppListView } from './views/app-list-view'

export function ApplicationsPage() {
  const { t } = useTranslation(['apps', 'common'])
  const navigate = useNavigate()
  const layout = useUiStore(s => s.layout)
  const isBoardLayout = layout === 'board'
  const appsQuery = useAppsListQuery({ page: 1, limit: 50 })
  const deleteMutation = useDeleteAppMutation()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AppSummary | null>(null)
  const [deleting, setDeleting] = useState<AppSummary | null>(null)

  const filtered = (appsQuery.data?.apps ?? []).filter(app =>
    !search || app.AppName.toLowerCase().includes(search.toLowerCase()),
  )

  const goToDetail = (app: AppSummary) => {
    void navigate({ to: '/applications/$appName', params: { appName: app.AppName } })
  }

  const onDelete = async () => {
    if (!deleting)
      return
    try {
      await deleteMutation.mutateAsync(deleting.ID)
      toast.success(t('deleted', { defaultValue: 'Application deleted' }))
      setDeleting(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  const renderView = () => {
    if (filtered.length === 0) {
      return (
        <EmptyState
          icon={Boxes}
          title={t('empty.title')}
          description={t('empty.description')}
          action={(
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('create', { defaultValue: 'New app' })}
            </Button>
          )}
        />
      )
    }
    if (layout === 'list') {
      return <AppListView apps={filtered} onSelect={goToDetail} onEdit={setEditing} onDelete={setDeleting} />
    }
    if (isBoardLayout) {
      return <AppBoardView apps={filtered} onSelect={goToDetail} onEdit={setEditing} onDelete={setDeleting} />
    }
    return <AppCardView apps={filtered} onSelect={goToDetail} onEdit={setEditing} onDelete={setDeleting} />
  }

  return (
    <div className={cn('min-w-0 max-w-full', isBoardLayout && 'app-board-page flex flex-col')}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        className={isBoardLayout ? 'shrink-0' : undefined}
        actions={(
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <LayoutSwitcher />
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('create', { defaultValue: 'New app' })}
            </Button>
          </div>
        )}
      />

      <div className={cn('dashboard-search-shell mb-4 flex items-center gap-2', isBoardLayout && 'shrink-0')}>
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

      {appsQuery.isPending && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {appsQuery.isError && (
        <EmptyState
          title={t('common:states.error')}
          description={(appsQuery.error as Error)?.message}
        />
      )}

      {appsQuery.isSuccess && (
        isBoardLayout
          ? <div className="min-h-0 flex-1">{renderView()}</div>
          : renderView()
      )}

      <AppFormDialog open={creating} onOpenChange={setCreating} />
      <AppFormDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditing(null)}
        app={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
        title={t('delete_title', { defaultValue: 'Delete application?' })}
        description={t('delete_description', {
          name: deleting?.AppName ?? '',
          defaultValue: 'All versions and artifacts of {{name}} will be removed. This cannot be undone.',
        })}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}

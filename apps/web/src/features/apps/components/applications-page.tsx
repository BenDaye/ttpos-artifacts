import type { AppSummary } from '@ttpos/shared'
import { CubeIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@ttpos/ui/components/button'
import { Card } from '@ttpos/ui/components/card'
import { Input } from '@ttpos/ui/components/input'
import { Skeleton } from '@ttpos/ui/components/skeleton'
import { cn } from '@ttpos/ui/lib/utils'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { ErrorState } from '@/shared/components/error-state'
import { LayoutSwitcher } from '@/shared/components/layout-switcher'
import { PageHeader } from '@/shared/components/page-header'
import { useSelectedEntity } from '@/shared/hooks/use-selected-entity'
import { useUiStore } from '@/shared/stores/ui-store'
import { useAppsListQuery, useDeleteAppMutation, useReorderAppsMutation } from '../hooks'
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
  const reorderMutation = useReorderAppsMutation()
  const allApps = appsQuery.data?.apps ?? []
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  // 编辑 / 删除目标按稳定 id 从完整应用列表派生「活」对象（用完整列表而非过滤后，
  // 避免改名后落出搜索过滤导致编辑中的目标被置空）；refetch 后弹层目标随之刷新，目标被删时自动关闭。
  const [editing, setEditingId] = useSelectedEntity(allApps, app => app.ID)
  const [deleting, setDeletingId] = useSelectedEntity(allApps, app => app.ID)

  // 搜索过滤激活时禁用拖拽，避免在子集上重排破坏完整顺序
  const isFiltering = search.trim() !== ''

  const filtered = allApps.filter(app =>
    !search || app.AppName.toLowerCase().includes(search.toLowerCase()),
  )

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

  const goToDetail = (app: AppSummary) => {
    void navigate({ to: '/applications/$appName', params: { appName: app.AppName } })
  }

  const onDelete = async () => {
    if (!deleting)
      return
    try {
      await deleteMutation.mutateAsync(deleting.ID)
      toast.success(t('deleted', { defaultValue: 'Application deleted' }))
      setDeletingId(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  // 加载骨架按当前布局选择匹配形态，外层容器与真实视图一致，避免数据到达时布局位移。
  const renderSkeleton = () => {
    if (layout === 'list') {
      return (
        <Card className="max-w-full overflow-hidden py-0">
          <div className="divide-y divide-border">
            {['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map(k => (
              <Skeleton key={k} className="h-12 rounded-none" />
            ))}
          </div>
        </Card>
      )
    }
    if (isBoardLayout) {
      return (
        <div className="flex h-full min-h-0 min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-2">
          {['sk-1', 'sk-2', 'sk-3'].map(k => (
            <Skeleton key={k} className="app-board-column h-full shrink-0 rounded-lg" />
          ))}
        </div>
      )
    }
    return (
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map(k => (
          <Skeleton key={k} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  const renderView = () => {
    if (filtered.length === 0) {
      return (
        <EmptyState
          icon={CubeIcon}
          title={t('empty.title')}
          description={t('empty.description')}
          action={(
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              {t('create', { defaultValue: 'New app' })}
            </Button>
          )}
        />
      )
    }
    if (layout === 'list') {
      return (
        <AppListView
          apps={filtered}
          onSelect={goToDetail}
          onEdit={app => setEditingId(app.ID)}
          onDelete={app => setDeletingId(app.ID)}
          onReorder={onReorder}
          canReorder={!isFiltering}
        />
      )
    }
    if (isBoardLayout) {
      return (
        <AppBoardView
          apps={filtered}
          onSelect={goToDetail}
          onEdit={app => setEditingId(app.ID)}
          onDelete={app => setDeletingId(app.ID)}
          onReorder={onReorder}
          canReorder={!isFiltering}
        />
      )
    }
    return (
      <AppCardView
        apps={filtered}
        onSelect={goToDetail}
        onEdit={app => setEditingId(app.ID)}
        onDelete={app => setDeletingId(app.ID)}
        onReorder={onReorder}
        canReorder={!isFiltering}
      />
    )
  }

  return (
    <div className={cn('min-w-0 max-w-full', isBoardLayout && 'app-board-page flex flex-col')}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        className={isBoardLayout ? 'shrink-0' : undefined}
        actions={(
          <div className="grid w-full min-w-0 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center" data-testid="applications-header-actions">
            <LayoutSwitcher className="justify-self-start" />
            <Button className="w-full sm:w-auto" onClick={() => setCreating(true)}>
              <PlusIcon />
              {t('create', { defaultValue: 'New app' })}
            </Button>
          </div>
        )}
      />

      <div className={cn('dashboard-search-shell mb-4 flex items-center gap-2', isBoardLayout && 'shrink-0')}>
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common:actions.search')}
            className="pl-9"
          />
        </div>
      </div>

      {appsQuery.isPending && (
        isBoardLayout
          ? <div className="min-h-0 flex-1">{renderSkeleton()}</div>
          : renderSkeleton()
      )}

      {appsQuery.isError && (
        <ErrorState onRetry={() => appsQuery.refetch()} />
      )}

      {appsQuery.isSuccess && (
        isBoardLayout
          ? <div className="min-h-0 flex-1">{renderView()}</div>
          : renderView()
      )}

      <AppFormDialog open={creating} onOpenChange={setCreating} />
      <AppFormDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditingId(null)}
        app={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeletingId(null)}
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

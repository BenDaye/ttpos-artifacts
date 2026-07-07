import type { AppSummary, AppVersion } from '@ttpos/shared'
import type { AppViewProps } from './types'
import type { SortableItemRenderProps } from '@/shared/components/common/sortable-list'
import { horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useQueries } from '@tanstack/react-query'
import { Badge } from '@ttpos/ui/components/badge'
import { Button } from '@ttpos/ui/components/button'
import { Card, CardContent } from '@ttpos/ui/components/card'
import { Skeleton } from '@ttpos/ui/components/skeleton'
import { cn } from '@ttpos/ui/lib/utils'
import { Boxes, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useChannelsQuery } from '@/features/channels/hooks'
import { SortableList } from '@/shared/components/common/sortable-list'
import { useSelectedEntity } from '@/shared/hooks/use-selected-entity'
import { appsApi } from '../../api'
import { SEARCH_KEY } from '../../hooks'
import { VersionDetailDialog } from '../version-detail-dialog'
import { sortVersionsByChannel } from '../version-ui'

export function AppBoardView({ apps, onSelect, onEdit, onDelete, onReorder, canReorder = false }: AppViewProps) {
  // 仅当存在重排回调且当前允许时才启用拖拽
  const reorderEnabled = canReorder && Boolean(onReorder)
  const versionQueries = useQueries({
    queries: apps.map(app => ({
      queryKey: [SEARCH_KEY, { app_name: app.AppName, page: 1, limit: 100, board: true }],
      queryFn: () => appsApi.search({ app_name: app.AppName, page: 1, limit: 100 }),
      enabled: Boolean(app.AppName),
      staleTime: 30_000,
    })),
  })

  const channelsQuery = useChannelsQuery()
  const channelOrder = useMemo(
    () => new Map((channelsQuery.data ?? []).map((c, i) => [c.ChannelName, i] as const)),
    [channelsQuery.data],
  )

  // 扁平化所有列的版本，按稳定 id 派生「活」版本传给详情弹层：
  // 弹层内新增 / 删除 artifact 失效查询、refetch 出新版本对象后，
  // 派生对象随之更新，弹层即时刷新而无需关闭重开（避免快照冻结）。
  // 跨列扁平查找依赖 version ID 全局唯一（后端实体主键，成立）。
  const allVersions = versionQueries.flatMap(query => query.data?.versions ?? [])
  const [selectedVersion, setSelectedVersionId] = useSelectedEntity(allVersions, version => version.ID)

  // 按 app.ID 索引版本查询结果，使拖拽重排后列与其版本数据保持对应，
  // 不依赖 useQueries 返回数组的 index 顺序。
  const versionByAppId = new Map(apps.map((app, idx) => [app.ID, versionQueries[idx]]))

  return (
    <>
      <SortableList
        ids={apps.map(app => app.ID)}
        onReorder={ids => onReorder?.(ids)}
        disabled={!reorderEnabled}
        strategy={horizontalListSortingStrategy}
        className="flex h-full max-w-full min-h-0 min-w-0 gap-3 overflow-x-auto overscroll-x-contain pb-2"
        renderItem={(id, sortable) => {
          const app = apps.find(item => item.ID === id)
          if (!app) {
            return null
          }
          const query = versionByAppId.get(id)
          return (
            <BoardColumn
              app={app}
              versions={sortVersionsByChannel(query?.data?.versions ?? [], channelOrder)}
              total={query?.data?.total ?? 0}
              isLoading={Boolean(query?.isPending)}
              isError={Boolean(query?.isError)}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onVersionSelect={version => setSelectedVersionId(version.ID)}
              selectedVersionId={selectedVersion?.ID}
              sortable={sortable}
              reorderEnabled={reorderEnabled}
            />
          )
        }}
      />
      <VersionDetailDialog
        open={Boolean(selectedVersion)}
        onOpenChange={open => !open && setSelectedVersionId(null)}
        version={selectedVersion}
      />
    </>
  )
}

interface BoardColumnProps {
  app: AppSummary
  versions: AppVersion[]
  total: number
  isLoading: boolean
  isError: boolean
  onSelect: (app: AppSummary) => void
  onEdit: (app: AppSummary) => void
  onDelete: (app: AppSummary) => void
  onVersionSelect: (version: AppVersion) => void
  selectedVersionId?: string
  sortable?: SortableItemRenderProps
  reorderEnabled?: boolean
}

function BoardColumn({ app, versions, total, isLoading, isError, onSelect, onEdit, onDelete, onVersionSelect, selectedVersionId, sortable, reorderEnabled = false }: BoardColumnProps) {
  const { t } = useTranslation(['apps', 'common'])

  return (
    <div
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={cn(
        'app-board-column flex h-full max-w-full min-h-0 shrink-0 flex-col rounded-lg border border-border bg-muted/30',
        sortable?.isDragging && 'opacity-50',
      )}
    >
      {/* 列头为非交互容器，内含 grip / 可点击区 / 操作区三个同级节点，
          避免把 grip 与编辑/删除按钮嵌套进一个 <button>（button-in-button 违规）。 */}
      <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        {reorderEnabled && sortable && (
          <button
            type="button"
            aria-label={t('reorder', { defaultValue: 'Drag to reorder' })}
            className="shrink-0 cursor-grab touch-none text-muted-foreground focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            {...sortable.handleProps}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onSelect(app)}
          data-testid="board-column-open"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:bg-accent/50 focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            {app.Logo
              ? <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
              : <Boxes className="size-4" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold" title={app.AppName}>{app.AppName}</span>
            <span className="text-xs text-muted-foreground">
              {t('board.versions_count', { count: total, defaultValue: '{{count}} version(s)' })}
            </span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('common:actions.edit')}
            onClick={() => onEdit(app)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('common:actions.delete')}
            onClick={() => onDelete(app)}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 py-2">
        {/* app-board-scroll-area: 列内版本列表滚动区,同时作为 e2e(responsive-layout) 定位锚点,勿删类名 */}
        <div className="app-board-scroll-area flex h-full min-h-0 flex-col gap-2 overflow-y-auto px-2 py-2">
          {isLoading && (
            <>
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </>
          )}
          {!isLoading && isError && (
            <p className="px-1 py-3 text-center text-xs text-destructive">
              {t('board.versions_error', { defaultValue: 'Failed to load versions' })}
            </p>
          )}
          {!isLoading && !isError && versions.length === 0 && (
            <p className="px-1 py-3 text-center text-xs text-muted-foreground">
              {t('board.column_empty', { defaultValue: 'No versions yet' })}
            </p>
          )}
          {!isLoading && !isError && versions.length > 0 && versions.map(version => (
            <VersionItem
              key={version.ID}
              version={version}
              isSelected={version.ID === selectedVersionId}
              onSelect={() => onVersionSelect(version)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface VersionItemProps {
  version: AppVersion
  isSelected?: boolean
  onSelect: () => void
}

function VersionItem({ version, isSelected = false, onSelect }: VersionItemProps) {
  const { t } = useTranslation(['apps', 'common'])
  const artifactCount = version.Artifacts?.length ?? 0
  const changelogText = Array.isArray(version.Changelog) && version.Changelog.length > 0
    ? version.Changelog[0]?.Changes
    : undefined

  return (
    <Card
      size="sm"
      role="button"
      tabIndex={0}
      aria-label={t('board.open_version_details', {
        version: version.Version,
        defaultValue: 'Open version {{version}} details',
      })}
      data-testid="board-version-card"
      aria-current={isSelected ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'cursor-pointer transition-colors hover:ring-foreground/30 hover:bg-accent/50 active:bg-accent focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        isSelected && 'ring-primary bg-secondary',
      )}
    >
      <CardContent className="space-y-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium">{version.Version}</span>
          {version.Channel && (
            <Badge variant="secondary" className="max-w-full truncate text-xs">{version.Channel}</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={version.Published
              ? 'border-primary bg-secondary text-primary text-xs'
              : 'text-xs text-muted-foreground'}
          >
            {version.Published
              ? t('board.published', { defaultValue: 'Published' })
              : t('badge.draft', { defaultValue: 'Draft' })}
          </Badge>
          {version.Critical && (
            <Badge variant="outline" className="border-primary bg-secondary text-primary text-xs">
              {t('badge.critical', { defaultValue: 'Critical' })}
            </Badge>
          )}
          {artifactCount > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {t('board.artifacts_count', { count: artifactCount, defaultValue: '{{count}} artifact(s)' })}
            </span>
          )}
        </div>
        {changelogText && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{changelogText}</p>
        )}
      </CardContent>
    </Card>
  )
}

import type { AppSummary, AppVersion } from '@ttpos/shared'
import type { AppViewProps } from './types'
import { useQueries } from '@tanstack/react-query'
import { Boxes, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { appsApi } from '../../api'

export function AppBoardView({ apps, onSelect, onEdit, onDelete }: AppViewProps) {
  const versionQueries = useQueries({
    queries: apps.map(app => ({
      queryKey: ['app-search', { app_name: app.AppName, page: 1, limit: 100, board: true }],
      queryFn: () => appsApi.search({ app_name: app.AppName, page: 1, limit: 100 }),
      enabled: Boolean(app.AppName),
      staleTime: 30_000,
    })),
  })

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {apps.map((app, idx) => {
        const query = versionQueries[idx]
        return (
          <BoardColumn
            key={app.ID}
            app={app}
            versions={query?.data?.versions ?? []}
            total={query?.data?.total ?? 0}
            isLoading={Boolean(query?.isPending)}
            isError={Boolean(query?.isError)}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )
      })}
    </div>
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
}

function BoardColumn({ app, versions, total, isLoading, isError, onSelect, onEdit, onDelete }: BoardColumnProps) {
  const { t } = useTranslation(['apps', 'common'])

  return (
    <div className="app-board-column flex shrink-0 flex-col rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => onSelect(app)}
        className="flex items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          {app.Logo
            ? <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
            : <Boxes className="size-4" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{app.AppName}</span>
          <span className="text-xs text-muted-foreground">
            {t('board.versions_count', { count: total, defaultValue: '{{count}} version(s)' })}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('common:actions.edit')}
            onClick={(e) => {
              e.stopPropagation()
              onEdit(app)
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('common:actions.delete')}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(app)
            }}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </button>

      <div className="app-board-scroll-area flex flex-1 flex-col gap-2 overflow-y-auto p-2">
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
          <VersionItem key={version.ID} version={version} onSelect={() => onSelect(app)} />
        ))}
      </div>
    </div>
  )
}

interface VersionItemProps {
  version: AppVersion
  onSelect: () => void
}

function VersionItem({ version, onSelect }: VersionItemProps) {
  const { t } = useTranslation(['apps', 'common'])
  const artifactCount = version.Artifacts?.length ?? 0
  const changelogText = Array.isArray(version.Changelog) && version.Changelog.length > 0
    ? version.Changelog[0]?.Changes
    : undefined

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className="cursor-pointer transition-colors hover:border-foreground/30 hover:bg-accent/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardContent className="space-y-1.5 p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{version.Version}</span>
          {version.Channel && (
            <Badge variant="secondary" className="text-micro">{version.Channel}</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={version.Published
              ? 'border-primary bg-secondary text-primary text-micro'
              : 'text-micro text-muted-foreground'}
          >
            {version.Published
              ? t('board.published', { defaultValue: 'Published' })
              : t('badge.draft', { defaultValue: 'Draft' })}
          </Badge>
          {version.Critical && (
            <Badge variant="outline" className="border-primary bg-secondary text-primary text-micro">
              {t('badge.critical', { defaultValue: 'Critical' })}
            </Badge>
          )}
          {artifactCount > 0 && (
            <span className="ml-auto text-micro text-muted-foreground">
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

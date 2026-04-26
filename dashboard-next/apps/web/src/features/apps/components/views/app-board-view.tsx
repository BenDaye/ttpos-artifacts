import type { AppSummary } from '@ttpos/shared'
import type { AppViewProps } from './types'
import { useQueries } from '@tanstack/react-query'
import { Boxes, Pencil, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useChannelsQuery } from '@/features/channels/hooks'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { appsApi } from '../../api'

const UNASSIGNED_KEY = '__unassigned__'

export function AppBoardView({ apps, onSelect, onEdit, onDelete }: AppViewProps) {
  const { t } = useTranslation(['apps', 'common'])
  const channelsQuery = useChannelsQuery()

  const versionQueries = useQueries({
    queries: apps.map(app => ({
      queryKey: ['app-search', { app_name: app.AppName, page: 1, limit: 100, board: true }],
      queryFn: () => appsApi.search({ app_name: app.AppName, page: 1, limit: 100 }),
      enabled: Boolean(app.AppName),
      staleTime: 30_000,
    })),
  })

  const isAggregating = versionQueries.some(q => q.isPending)

  const channelToApps = useMemo(() => {
    const map = new Map<string, AppSummary[]>()
    ;(channelsQuery.data ?? []).forEach(c => map.set(c.ChannelName, []))

    apps.forEach((app, idx) => {
      const result = versionQueries[idx]?.data
      if (!result) {
        return
      }
      const seen = new Set<string>()
      result.versions.forEach((v) => {
        if (v.Channel) {
          seen.add(v.Channel)
        }
      })
      if (seen.size === 0) {
        const list = map.get(UNASSIGNED_KEY) ?? []
        if (!list.includes(app)) {
          list.push(app)
        }
        map.set(UNASSIGNED_KEY, list)
        return
      }
      seen.forEach((channel) => {
        const list = map.get(channel) ?? []
        if (!list.includes(app)) {
          list.push(app)
          map.set(channel, list)
        }
      })
    })
    return map
  }, [apps, channelsQuery.data, versionQueries])

  const columns = useMemo(() => {
    const ordered: { key: string, name: string }[] = []
    ;(channelsQuery.data ?? []).forEach(c => ordered.push({ key: c.ChannelName, name: c.ChannelName }))
    const unassigned = channelToApps.get(UNASSIGNED_KEY) ?? []
    if (unassigned.length > 0) {
      ordered.push({ key: UNASSIGNED_KEY, name: t('board.unassigned', { defaultValue: 'No channel' }) })
    }
    return ordered
  }, [channelsQuery.data, channelToApps, t])

  if (channelsQuery.isPending || (apps.length > 0 && isAggregating)) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-[300px] shrink-0 rounded-xl" />
        ))}
      </div>
    )
  }

  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('board.empty', { defaultValue: 'No channels configured. Create a channel first.' })}
      </p>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map(col => (
        <BoardColumn
          key={col.key}
          name={col.name}
          apps={channelToApps.get(col.key) ?? []}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

interface BoardColumnProps {
  name: string
  apps: AppSummary[]
  onSelect: (app: AppSummary) => void
  onEdit: (app: AppSummary) => void
  onDelete: (app: AppSummary) => void
}

function BoardColumn({ name, apps, onSelect, onEdit, onDelete }: BoardColumnProps) {
  const { t } = useTranslation(['apps', 'common'])
  return (
    <div className="flex w-[300px] shrink-0 flex-col rounded-lg border border-border bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="truncate text-sm font-semibold">{name}</span>
        <Badge variant="outline" className="text-[10px]">{apps.length}</Badge>
      </div>
      <div className="flex max-h-[calc(100vh-260px)] flex-1 flex-col gap-2 overflow-y-auto p-2">
        {apps.length === 0
          ? (
              <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                {t('board.column_empty', { defaultValue: 'No apps in this channel.' })}
              </p>
            )
          : (
              apps.map(app => (
                <Card
                  key={app.ID}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(app)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(app)
                    }
                  }}
                  className="cursor-pointer transition-colors hover:border-foreground/30 hover:shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                          {app.Logo
                            ? <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
                            : <Boxes className="size-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{app.AppName}</p>
                          {app.Description && (
                            <p className="line-clamp-1 text-[11px] text-muted-foreground">{app.Description}</p>
                          )}
                        </div>
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
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
      </div>
    </div>
  )
}

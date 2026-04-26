import type { AppSummary } from '@ttpos/shared'
import type { AppViewProps } from './types'
import { Boxes, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useAppVersionsQuery } from '../../hooks'

export function AppBoardView({ apps, onSelect, onEdit, onDelete }: AppViewProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-min gap-3">
        {apps.map(app => (
          <BoardColumn
            key={app.ID}
            app={app}
            onSelect={() => onSelect(app)}
            onEdit={() => onEdit(app)}
            onDelete={() => onDelete(app)}
          />
        ))}
      </div>
    </div>
  )
}

interface ColumnProps {
  app: AppSummary
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

function BoardColumn({ app, onSelect, onEdit, onDelete }: ColumnProps) {
  const { t } = useTranslation(['apps', 'common'])
  const versions = useAppVersionsQuery({ app_name: app.AppName, page: 1, limit: 5 })
  const items = versions.data?.versions ?? []

  return (
    <Card className="flex w-72 shrink-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border p-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            {app.Logo
              ? <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
              : <Boxes className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{app.AppName}</p>
            {versions.data && (
              <p className="text-xs text-muted-foreground">
                {t('detail.summary', { count: versions.data.total ?? items.length, defaultValue: '{{count}} version(s)' })}
              </p>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-7" aria-label={t('common:actions.edit')} onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" aria-label={t('common:actions.delete')} onClick={onDelete}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto p-2">
        {versions.isPending && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </>
        )}
        {versions.isSuccess && items.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t('detail.empty.title', { defaultValue: 'No versions yet' })}
          </p>
        )}
        {items.map(v => (
          <button
            key={v.ID}
            type="button"
            onClick={onSelect}
            className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-medium">{v.Version}</span>
            {v.Channel && <Badge variant="secondary" className="text-[10px]">{v.Channel}</Badge>}
            {v.Critical && <Badge variant="destructive" className="text-[10px]">{t('badge.critical')}</Badge>}
            {!v.Published && <Badge variant="warning" className="text-[10px]">{t('badge.draft')}</Badge>}
          </button>
        ))}
      </div>
    </Card>
  )
}

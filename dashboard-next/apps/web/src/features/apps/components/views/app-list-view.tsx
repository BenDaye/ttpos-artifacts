import type { AppViewProps } from './types'
import { Boxes, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { formatDateTime } from '@/shared/lib/format'

export function AppListView({ apps, onSelect, onEdit, onDelete }: AppViewProps) {
  const { t } = useTranslation(['apps', 'common'])
  return (
    <Card className="overflow-hidden">
      <div role="table" className="divide-y divide-border">
        <div role="row" className="app-list-header-grid hidden bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid sm:gap-3">
          <div>{t('list.name', { defaultValue: 'Name' })}</div>
          <div>{t('list.description', { defaultValue: 'Description' })}</div>
          <div>{t('updated_at')}</div>
          <div className="text-right">{t('list.actions', { defaultValue: 'Actions' })}</div>
        </div>
        {apps.map(app => (
          <div
            key={app.ID}
            role="row"
            tabIndex={0}
            onClick={() => onSelect(app)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(app)
              }
            }}
            className="app-list-row-grid grid cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                {app.Logo
                  ? <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
                  : <Boxes className="size-3.5" />}
              </div>
              <span className="truncate text-sm font-medium">{app.AppName}</span>
            </div>
            <div className="hidden truncate text-xs text-muted-foreground sm:block">{app.Description || '—'}</div>
            <div className="hidden text-xs text-muted-foreground sm:block">{formatDateTime(app.Updated_at) || '—'}</div>
            <div className="flex items-center justify-end gap-1">
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
        ))}
      </div>
    </Card>
  )
}

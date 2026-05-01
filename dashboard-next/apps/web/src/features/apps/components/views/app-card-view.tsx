import type { AppViewProps } from './types'
import { Boxes, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { formatDateTime } from '@/shared/lib/format'

export function AppCardView({ apps, onSelect, onEdit, onDelete }: AppViewProps) {
  const { t } = useTranslation(['apps', 'common'])
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map(app => (
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
          className="cursor-pointer transition-colors hover:border-foreground/30 hover:bg-accent/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  {app.Logo
                    ? <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
                    : <Boxes className="size-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{app.AppName}</p>
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
      ))}
    </div>
  )
}

import { Link } from '@tanstack/react-router'
import { Boxes, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useAppsListQuery, useDeleteAppMutation } from '../hooks'
import { UploadVersionDialog } from './upload-version-dialog'

export function ApplicationsPage() {
  const { t } = useTranslation(['apps', 'common'])
  const appsQuery = useAppsListQuery({ page: 1, limit: 50 })
  const deleteMutation = useDeleteAppMutation()
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<{ id: string, name: string } | null>(null)

  const filtered = (appsQuery.data?.apps ?? []).filter(app =>
    !search || app.AppName.toLowerCase().includes(search.toLowerCase()),
  )

  const onDelete = async () => {
    if (!deleting)
      return
    try {
      await deleteMutation.mutateAsync(deleting.id)
      toast.success(t('deleted', { defaultValue: 'Application deleted' }))
      setDeleting(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={(
          <Button onClick={() => setUploading(true)}>
            <Plus className="size-4" />
            {t('upload', { defaultValue: 'Upload version' })}
          </Button>
        )}
      />

      <div className="mb-4 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      {appsQuery.isSuccess && filtered.length === 0 && (
        <EmptyState
          icon={Boxes}
          title={t('empty.title')}
          description={t('empty.description')}
          action={(
            <Button onClick={() => setUploading(true)}>
              <Plus className="size-4" />
              {t('upload', { defaultValue: 'Upload version' })}
            </Button>
          )}
        />
      )}

      {filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(app => (
            <Card key={app.ID} className="transition-colors hover:border-foreground/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/applications/$appName"
                    params={{ appName: app.AppName }}
                    className="flex flex-1 items-center gap-3 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      {app.Logo
                        ? (
                            <img src={app.Logo} alt="" className="size-full rounded-md object-cover" />
                          )
                        : (
                            <Boxes className="size-5" />
                          )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{app.AppName}</p>
                      {app.Description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">{app.Description}</p>
                      )}
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common:actions.delete')}
                    onClick={() => setDeleting({ id: app.ID, name: app.AppName })}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                {app.Updated_at && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t('updated_at', { defaultValue: 'Updated' })}
                    {' '}
                    {new Date(app.Updated_at).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UploadVersionDialog open={uploading} onOpenChange={setUploading} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
        title={t('delete_title', { defaultValue: 'Delete application?' })}
        description={t('delete_description', {
          name: deleting?.name ?? '',
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

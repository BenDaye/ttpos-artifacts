import type { AppVersion } from '@ttpos/shared'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Boxes, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { Badge } from '@/shared/components/ui/badge'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useAppVersionsQuery, useDeleteVersionMutation } from '../hooks'
import { UploadVersionDialog } from './upload-version-dialog'
import { VersionEditDialog } from './version-edit-dialog'

export function AppDetailPage({ appName }: { appName: string }) {
  const { t } = useTranslation(['apps', 'common'])
  const [page] = useState(1)
  const versionsQuery = useAppVersionsQuery({ app_name: appName, page, limit: 50 })
  const deleteVersion = useDeleteVersionMutation()
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<AppVersion | null>(null)
  const [deleting, setDeleting] = useState<AppVersion | null>(null)

  const onDelete = async () => {
    if (!deleting)
      return
    try {
      await deleteVersion.mutateAsync(deleting.ID)
      toast.success(t('version_deleted', { defaultValue: 'Version deleted' }))
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
        title={appName}
        description={t('detail.description')}
        actions={(
          <div className="flex items-center gap-2">
            <Link to="/applications" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ArrowLeft className="size-4" />
              {t('detail.back')}
            </Link>
            <Button size="sm" onClick={() => setUploading(true)}>
              <Plus className="size-4" />
              {t('upload', { defaultValue: 'Upload version' })}
            </Button>
          </div>
        )}
      />

      {versionsQuery.isPending && (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {versionsQuery.isError && (
        <EmptyState
          title={t('common:states.error')}
          description={(versionsQuery.error as Error)?.message}
        />
      )}

      {versionsQuery.isSuccess && versionsQuery.data.versions.length === 0 && (
        <EmptyState
          icon={Boxes}
          title={t('detail.empty.title', { defaultValue: 'No versions yet' })}
          description={t('detail.empty.description', {
            defaultValue: 'Upload your first artifact to get started.',
          })}
        />
      )}

      {versionsQuery.isSuccess && versionsQuery.data.versions.length > 0 && (
        <ul className="grid gap-3">
          {versionsQuery.data.versions.map(v => (
            <VersionRow
              key={v.ID}
              version={v}
              onEdit={() => setEditing(v)}
              onDelete={() => setDeleting(v)}
            />
          ))}
        </ul>
      )}

      <UploadVersionDialog open={uploading} onOpenChange={setUploading} defaultAppName={appName} />
      <VersionEditDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditing(null)}
        version={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
        title={t('delete_version_title', { defaultValue: 'Delete version?' })}
        description={t('delete_version_description', {
          version: deleting?.Version ?? '',
          defaultValue: 'Version {{version}} and its artifacts will be permanently removed.',
        })}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteVersion.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}

interface VersionRowProps {
  version: AppVersion
  onEdit: () => void
  onDelete: () => void
}

function VersionRow({ version, onEdit, onDelete }: VersionRowProps) {
  const { t } = useTranslation(['apps', 'common'])
  const [showChangelog, setShowChangelog] = useState(false)
  return (
    <li>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{version.Version}</span>
                {version.Channel && <Badge variant="secondary">{version.Channel}</Badge>}
                {version.Platform && <Badge variant="outline">{version.Platform}</Badge>}
                {version.Arch && <Badge variant="outline">{version.Arch}</Badge>}
                {version.Critical && <Badge variant="destructive">Critical</Badge>}
                {!version.Published && <Badge variant="warning">Draft</Badge>}
              </div>
              {version.Updated_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(version.Updated_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {version.Artifacts?.map(a => (
                <a
                  key={a.link}
                  href={a.link}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {[a.platform, a.arch].filter(Boolean).join('/')}
                </a>
              ))}
              <Button variant="ghost" size="icon" aria-label={t('common:actions.edit')} onClick={onEdit}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common:actions.delete')}
                onClick={onDelete}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
          {version.Changelog && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowChangelog(s => !s)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  className={`size-3 transition-transform ${showChangelog ? 'rotate-180' : ''}`}
                />
                {t('changelog', { defaultValue: 'Changelog' })}
              </button>
              {showChangelog && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">
                  {version.Changelog}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  )
}

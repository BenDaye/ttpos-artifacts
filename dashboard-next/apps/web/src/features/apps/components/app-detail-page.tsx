import type { AppVersion, ArtifactEntry, ChangelogEntry } from '@ttpos/shared'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Boxes, ChevronDown, Download, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { formatDateTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import {
  useAppVersionsQuery,
  useDeleteArtifactMutation,
  useDeleteVersionMutation,
} from '../hooks'
import { UploadVersionDialog } from './upload-version-dialog'
import { VersionEditDialog } from './version-edit-dialog'

interface ArtifactKey {
  versionId: string
  appName: string
  versionStr: string
  link: string
  package: string
}

export function AppDetailPage({ appName }: { appName: string }) {
  const { t } = useTranslation(['apps', 'common'])
  const [page] = useState(1)
  const versionsQuery = useAppVersionsQuery({ app_name: appName, page, limit: 50 })
  const deleteVersion = useDeleteVersionMutation()
  const deleteArtifact = useDeleteArtifactMutation()
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<AppVersion | null>(null)
  const [deletingVersion, setDeletingVersion] = useState<AppVersion | null>(null)
  const [deletingArtifact, setDeletingArtifact] = useState<ArtifactKey | null>(null)

  const onDeleteVersion = async () => {
    if (!deletingVersion)
      return
    try {
      await deleteVersion.mutateAsync(deletingVersion.ID)
      toast.success(t('version_deleted', { defaultValue: 'Version deleted' }))
      setDeletingVersion(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  const onDeleteArtifact = async () => {
    if (!deletingArtifact)
      return
    try {
      await deleteArtifact.mutateAsync({
        id: deletingArtifact.versionId,
        app_name: deletingArtifact.appName,
        version: deletingArtifact.versionStr,
        artifacts_to_delete: [deletingArtifact.package || deletingArtifact.link],
      })
      toast.success(t('artifact_deleted', { defaultValue: 'Artifact deleted' }))
      setDeletingArtifact(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  const versions = versionsQuery.data?.versions ?? []
  const total = versionsQuery.data?.total ?? versions.length

  return (
    <div>
      <PageHeader
        title={appName}
        description={
          versionsQuery.isSuccess
            ? t('detail.summary', { count: total, defaultValue: '{{count}} version(s)' })
            : t('detail.description')
        }
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
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {versionsQuery.isError && (
        <EmptyState
          title={t('common:states.error')}
          description={(versionsQuery.error as Error)?.message}
        />
      )}

      {versionsQuery.isSuccess && versions.length === 0 && (
        <EmptyState
          icon={Boxes}
          title={t('detail.empty.title', { defaultValue: 'No versions yet' })}
          description={t('detail.empty.description', {
            defaultValue: 'Upload your first artifact to get started.',
          })}
          action={(
            <Button onClick={() => setUploading(true)}>
              <Plus className="size-4" />
              {t('upload', { defaultValue: 'Upload version' })}
            </Button>
          )}
        />
      )}

      {versions.length > 0 && (
        <ul className="grid gap-3">
          {versions.map(v => (
            <VersionRow
              key={v.ID}
              version={v}
              onEdit={() => setEditing(v)}
              onDelete={() => setDeletingVersion(v)}
              onDeleteArtifact={artifact => setDeletingArtifact({
                versionId: v.ID,
                appName: v.AppName,
                versionStr: v.Version,
                link: artifact.link,
                package: artifact.package,
              })}
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
        open={Boolean(deletingVersion)}
        onOpenChange={open => !open && setDeletingVersion(null)}
        title={t('delete_version_title', { defaultValue: 'Delete version?' })}
        description={t('delete_version_description', {
          version: deletingVersion?.Version ?? '',
          defaultValue: 'Version {{version}} and its artifacts will be permanently removed.',
        })}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteVersion.isPending}
        onConfirm={onDeleteVersion}
      />
      <ConfirmDialog
        open={Boolean(deletingArtifact)}
        onOpenChange={open => !open && setDeletingArtifact(null)}
        title={t('delete_artifact_title', { defaultValue: 'Delete artifact?' })}
        description={t('delete_artifact_description', {
          name: deletingArtifact?.package ?? '',
          defaultValue: 'Artifact {{name}} will be permanently removed.',
        })}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteArtifact.isPending}
        onConfirm={onDeleteArtifact}
      />
    </div>
  )
}

interface VersionRowProps {
  version: AppVersion
  onEdit: () => void
  onDelete: () => void
  onDeleteArtifact: (artifact: ArtifactEntry) => void
}

function VersionRow({ version, onEdit, onDelete, onDeleteArtifact }: VersionRowProps) {
  const { t } = useTranslation(['apps', 'common'])
  const [showChangelog, setShowChangelog] = useState(false)
  const artifacts = version.Artifacts ?? []
  const changelog = version.Changelog ?? []
  const updatedAt = formatDateTime(version.Updated_at)

  return (
    <li>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{version.Version}</span>
                {version.Channel && <Badge variant="secondary">{version.Channel}</Badge>}
                {version.Critical && <Badge variant="destructive">{t('badge.critical', { defaultValue: 'Critical' })}</Badge>}
                {version.Intermediate && <Badge variant="outline">{t('badge.intermediate', { defaultValue: 'Intermediate' })}</Badge>}
                {!version.Published && <Badge variant="warning">{t('badge.draft', { defaultValue: 'Draft' })}</Badge>}
              </div>
              {updatedAt && (
                <p className="mt-1 text-xs text-muted-foreground">{updatedAt}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
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

          {artifacts.length > 0
            ? (
                <div className="mt-3 grid gap-1.5">
                  {artifacts.map(a => (
                    <div
                      key={a.link}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{a.platform || '—'}</Badge>
                        <Badge variant="outline">{a.arch || '—'}</Badge>
                        <span className="truncate font-mono text-muted-foreground">
                          {a.package || a.link.split('/').pop()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 px-2.5 text-xs')}
                        >
                          <Download className="size-3" />
                          {t('actions.download', { defaultValue: 'Download' })}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t('common:actions.delete')}
                          onClick={() => onDeleteArtifact(a)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            : (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t('detail.no_artifacts', { defaultValue: 'No artifacts attached.' })}
                </p>
              )}

          {changelog.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowChangelog(s => !s)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  className={cn('size-3 transition-transform', showChangelog && 'rotate-180')}
                />
                {t('changelog', { defaultValue: 'Changelog' })}
                {' '}
                (
                {changelog.length}
                )
              </button>
              {showChangelog && (
                <div className="mt-2 space-y-2">
                  {changelog.map((entry, i) => (
                    <ChangelogItem key={`${entry.Version}-${entry.Date}-${i}`} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  )
}

function ChangelogItem({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{entry.Version}</span>
        {entry.Date && <span className="text-muted-foreground">{entry.Date}</span>}
      </div>
      <pre className="whitespace-pre-wrap font-sans text-foreground">{entry.Changes}</pre>
    </div>
  )
}

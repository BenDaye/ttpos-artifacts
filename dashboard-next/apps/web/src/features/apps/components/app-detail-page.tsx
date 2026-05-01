import type { AppVersion, ArtifactEntry } from '@ttpos/shared'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, Boxes, Download, FilePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChangelogModal } from '@/shared/components/common/changelog-modal'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { Badge } from '@/shared/components/ui/badge'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatDateTime } from '@/shared/lib/format'
import { appsApi } from '../api'
import {
  useAppVersionsQuery,
  useDeleteArtifactMutation,
  useDeleteVersionMutation,
} from '../hooks'
import { AddArtifactDialog } from './add-artifact-dialog'
import { DownloadArtifactsDialog } from './download-artifacts-dialog'
import { UploadVersionDialog } from './upload-version-dialog'
import { VersionEditDialog } from './version-edit-dialog'
import { EMPTY_VERSION_FILTERS, VersionFilterBar } from './version-filter-bar'

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
  const [filters, setFilters] = useState(EMPTY_VERSION_FILTERS)
  const versionsQuery = useAppVersionsQuery({
    app_name: appName,
    page,
    limit: 50,
    channel: filters.channels.length === 1 ? filters.channels[0] : undefined,
    platform: filters.platforms.length === 1 ? filters.platforms[0] : undefined,
    arch: filters.archs.length === 1 ? filters.archs[0] : undefined,
    published: filters.publishedOnly || undefined,
    critical: filters.criticalOnly || undefined,
  })
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

  const allVersions = versionsQuery.data?.versions ?? []
  const versions = useMemo(() => {
    return allVersions.filter((v) => {
      if (filters.channels.length > 1 && !filters.channels.includes(v.Channel))
        return false
      if (filters.platforms.length > 1) {
        const hit = (v.Artifacts ?? []).some(a => filters.platforms.includes(a.platform))
        if (!hit)
          return false
      }
      if (filters.archs.length > 1) {
        const hit = (v.Artifacts ?? []).some(a => filters.archs.includes(a.arch))
        if (!hit)
          return false
      }
      const q = filters.search.trim().toLowerCase()
      if (q) {
        const hay = [v.Version, v.Channel, ...(v.Changelog ?? []).map(c => c.Changes)].join(' ').toLowerCase()
        if (!hay.includes(q))
          return false
      }
      return true
    })
  }, [allVersions, filters])
  const total = versionsQuery.data?.total ?? allVersions.length

  return (
    <div className="min-w-0 max-w-full">
      <PageHeader
        title={appName}
        description={
          versionsQuery.isSuccess
            ? t('detail.summary', { count: total, defaultValue: '{{count}} version(s)' })
            : t('detail.description')
        }
        actions={(
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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

      <VersionFilterBar value={filters} onChange={setFilters} />

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
        <ul className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
  const [showDownloads, setShowDownloads] = useState(false)
  const [showAddArtifact, setShowAddArtifact] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const artifacts = version.Artifacts ?? []
  const changelog = version.Changelog ?? []
  const updatedAt = formatDateTime(version.Updated_at)

  const onDownload = async (link: string) => {
    try {
      setDownloading(link)
      const resolvedLink = await appsApi.resolveDownloadUrl(link)
      window.open(resolvedLink, '_blank', 'noreferrer')
    }
    catch {
      toast.error(t('download_dialog.resolve_failed', { defaultValue: 'Could not prepare download URL' }))
    }
    finally {
      setDownloading(null)
    }
  }

  return (
    <li data-testid="version-card">
      <Card className={version.Published ? 'relative h-full overflow-hidden' : 'relative h-full overflow-hidden border-primary'}>
        {!version.Published && (
          <Badge
            variant="default"
            className="absolute right-sm top-sm z-10"
            data-testid="version-draft-ribbon"
          >
            {t('badge.draft', { defaultValue: 'Draft' })}
          </Badge>
        )}
        <CardContent className={version.Published ? 'flex h-full min-w-0 flex-col p-4' : 'flex h-full min-w-0 flex-col p-4 pt-xl'}>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold">{version.Version}</p>
              </div>
              <div className="flex max-w-full flex-wrap items-center gap-2">
                {version.Channel && <Badge variant="secondary" className="max-w-full truncate">{version.Channel}</Badge>}
                {version.Published
                  ? <Badge variant="success">{t('board.published', { defaultValue: 'Published' })}</Badge>
                  : <Badge variant="warning">{t('badge.draft', { defaultValue: 'Draft' })}</Badge>}
                {version.Critical && <Badge variant="destructive">{t('badge.critical', { defaultValue: 'Critical' })}</Badge>}
                {version.Intermediate && <Badge variant="outline">{t('badge.intermediate', { defaultValue: 'Intermediate' })}</Badge>}
              </div>
              {updatedAt && (
                <p className="mt-1 text-xs text-muted-foreground">{updatedAt}</p>
              )}
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-1">
              {changelog.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0 max-w-full"
                  onClick={() => setShowChangelog(true)}
                >
                  <BookOpen className="size-3.5" />
                  <span className="min-w-0 truncate">
                    {t('changelog')}
                    {' '}
                    (
                    {changelog.length}
                    )
                  </span>
                </Button>
              )}
              {artifacts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0 max-w-full"
                  onClick={() => setShowDownloads(true)}
                >
                  <Download className="size-3.5" />
                  <span className="min-w-0 truncate">
                    {t('actions.download')}
                    {' '}
                    (
                    {artifacts.length}
                    )
                  </span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="min-w-0 max-w-full"
                onClick={() => setShowAddArtifact(true)}
              >
                <FilePlus className="size-3.5" />
                <span className="min-w-0 truncate">{t('add_artifact.button', { defaultValue: 'Add artifact' })}</span>
              </Button>
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

          <AddArtifactDialog
            open={showAddArtifact}
            onOpenChange={setShowAddArtifact}
            version={version}
          />

          <ChangelogModal
            open={showChangelog}
            onOpenChange={setShowChangelog}
            entries={changelog}
            title={`${version.AppName} · v${version.Version} · ${t('changelog')}`}
            description={t('changelog_modal.description', {
              count: changelog.length,
              defaultValue: '{{count}} change set(s)',
            })}
          />
          <DownloadArtifactsDialog
            open={showDownloads}
            onOpenChange={setShowDownloads}
            appName={version.AppName}
            versionStr={version.Version}
            artifacts={artifacts}
          />

          {artifacts.length > 0
            ? (
                <div className="mt-3 grid min-w-0 gap-1.5">
                  {artifacts.map(a => (
                    <div
                      key={a.link}
                      className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="max-w-full truncate">{a.platform || '—'}</Badge>
                        <Badge variant="outline" className="max-w-full truncate">{a.arch || '—'}</Badge>
                        <span className="min-w-0 break-words font-mono text-muted-foreground">
                          {a.package || a.link.split('/').pop()}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 min-w-0 max-w-full px-2.5 text-xs"
                          disabled={downloading === a.link}
                          onClick={() => onDownload(a.link)}
                        >
                          <Download className="size-3" />
                          <span className="min-w-0 truncate">{t('actions.download', { defaultValue: 'Download' })}</span>
                        </Button>
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

        </CardContent>
      </Card>
    </li>
  )
}

import type { AppVersion, ArtifactEntry } from '@ttpos/shared'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, Boxes, Download, FilePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { appsApi } from '../api'
import {
  useAppVersionsQuery,
  useDeleteArtifactMutation,
  useDeleteVersionMutation,
} from '../hooks'
import { AddArtifactDialog } from './add-artifact-dialog'
import { ChangelogModal } from './changelog-modal'
import { DownloadArtifactsDialog } from './download-artifacts-dialog'
import { UploadVersionDialog } from './upload-version-dialog'
import { VersionEditDialog } from './version-edit-dialog'
import { EMPTY_VERSION_FILTERS, VersionFilterBar } from './version-filter-bar'
import { getArtifactFileName, getVersionTone } from './version-ui'

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
          <div className="grid w-full min-w-0 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Link to="/applications" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full sm:w-auto')}>
              <ArrowLeft className="size-4" />
              {t('detail.back')}
            </Link>
            <Button size="sm" className="w-full sm:w-auto" onClick={() => setUploading(true)}>
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
        <ul className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
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

      <UploadVersionDialog open={uploading} onOpenChange={setUploading} appName={appName} />
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
  const tone = getVersionTone(version)
  const statusParts = [
    version.Critical ? t('badge.critical', { defaultValue: 'Critical' }) : null,
    version.Published
      ? t('board.published', { defaultValue: 'Published' })
      : t('badge.draft', { defaultValue: 'Draft' }),
    version.Intermediate ? t('badge.intermediate', { defaultValue: 'Intermediate' }) : null,
  ].filter(Boolean)
  const statusSummary = [
    statusParts.join(' / '),
    updatedAt,
  ].filter(Boolean).join(' · ')

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
      <Card className="h-full overflow-hidden">
        <CardContent className="flex h-full min-w-0 flex-col gap-md px-lg pb-lg pt-xl">
          <div className="flex min-w-0 items-start justify-between gap-md">
            <div className="min-w-0 flex-1 space-y-sm">
              <div className="flex min-w-0 flex-wrap items-baseline gap-sm">
                <p
                  className={cn(
                    'min-w-0 break-all font-display text-lg font-semibold',
                    tone === 'critical' && 'text-destructive',
                    tone === 'published' && 'text-primary',
                    tone === 'draft' && 'text-foreground',
                  )}
                  data-testid="version-title"
                  data-version-tone={tone}
                >
                  {version.Version}
                </p>
                {version.Channel && (
                  <Badge
                    variant="secondary"
                    className="min-w-0 max-w-full shrink-0 truncate uppercase"
                    data-testid="version-channel-chip"
                  >
                    {version.Channel.toUpperCase()}
                  </Badge>
                )}
              </div>
              {statusSummary && (
                <p className="text-sm text-muted-foreground" data-testid="version-status-text">
                  {statusSummary}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-xxs">
              <Button variant="ghost" size="icon" className="size-xl" aria-label={t('common:actions.edit')} onClick={onEdit}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-xl"
                aria-label={t('common:actions.delete')}
                onClick={onDelete}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-xs border-t border-border pt-sm">
            {changelog.length > 0 && (
              <Button
                variant="link"
                size="sm"
                className="h-auto min-w-0 max-w-full px-xs py-xs text-primary no-underline hover:no-underline"
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
                variant="link"
                size="sm"
                className="h-auto min-w-0 max-w-full px-xs py-xs text-primary no-underline hover:no-underline"
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
              variant="link"
              size="sm"
              className="h-auto min-w-0 max-w-full px-xs py-xs text-primary no-underline hover:no-underline"
              onClick={() => setShowAddArtifact(true)}
            >
              <FilePlus className="size-3.5" />
              <span className="min-w-0 truncate">{t('add_artifact.button', { defaultValue: 'Add artifact' })}</span>
            </Button>
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
                <div className="grid min-w-0 gap-xs">
                  <div className="flex min-w-0 items-center justify-between gap-sm text-sm">
                    <span className="font-semibold text-foreground">
                      {t('detail.artifacts', { defaultValue: 'Artifacts' })}
                    </span>
                    <span className="text-muted-foreground">
                      {t('detail.artifact_count', {
                        count: artifacts.length,
                        defaultValue: '{{count}} file(s)',
                      })}
                    </span>
                  </div>
                  {artifacts.map(a => (
                    <div
                      key={a.link}
                      className="flex min-w-0 flex-col gap-sm border-t border-border py-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-xs">
                        <p className="min-w-0 break-words text-base font-semibold text-foreground">
                          {a.platform || t('detail.unknown_platform', { defaultValue: 'Unknown platform' })}
                          <span className="text-muted-foreground">
                            {' '}
                            /
                            {' '}
                          </span>
                          {a.arch || t('detail.unknown_architecture', { defaultValue: 'Unknown architecture' })}
                        </p>
                        <p className="min-w-0 break-all font-mono text-sm text-muted-foreground">
                          {getArtifactFileName(a)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-xs">
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto min-w-0 max-w-full px-xs py-xs text-primary no-underline hover:no-underline"
                          disabled={downloading === a.link}
                          onClick={() => onDownload(a.link)}
                        >
                          <Download className="size-3" />
                          <span className="min-w-0 truncate">{t('actions.download', { defaultValue: 'Download' })}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-xl"
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
                <p className="border-t border-border pt-sm text-sm text-muted-foreground">
                  {t('detail.no_artifacts', { defaultValue: 'No artifacts attached.' })}
                </p>
              )}

        </CardContent>
      </Card>
    </li>
  )
}

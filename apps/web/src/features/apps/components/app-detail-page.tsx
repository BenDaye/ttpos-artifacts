import type { AppVersion, ArtifactEntry } from '@ttpos/shared'
import type { TriggerBuildResponse } from '@/features/build-trigger/api'
import { ArrowLeftIcon, BookOpenIcon, CubeIcon, DownloadSimpleIcon, FilePlusIcon, HammerIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@ttpos/ui/components/badge'
import { Button, buttonVariants } from '@ttpos/ui/components/button'
import { Card, CardContent } from '@ttpos/ui/components/card'
import { Skeleton } from '@ttpos/ui/components/skeleton'
import { cn } from '@ttpos/ui/lib/utils'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BuildStatusSheet } from '@/features/build-trigger/components/build-status-sheet'
import { TriggerBuildDialog } from '@/features/build-trigger/components/trigger-build-dialog'
import { useChannelsQuery } from '@/features/channels/hooks'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { ErrorState } from '@/shared/components/error-state'
import { PageHeader } from '@/shared/components/page-header'
import { useSelectedEntity } from '@/shared/hooks/use-selected-entity'
import { formatDateTime } from '@/shared/lib/format'
import { appsApi, buildDeleteArtifactPayload } from '../api'
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
import { getArtifactFileName, getVersionTone, sortVersionsByChannel } from './version-ui'

interface ArtifactKey {
  versionId: string
  appName: string
  versionStr: string
  // link 既用于确认弹层显示,也作为稳定标识发给后端删除
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
  const channelsQuery = useChannelsQuery()
  const deleteVersion = useDeleteVersionMutation()
  const deleteArtifact = useDeleteArtifactMutation()

  /* eslint-disable react/exhaustive-deps -- allVersions 每渲染从最新查询数据派生(喂 useSelectedEntity),刻意不 memo 化以避免选中 stale */
  const allVersions = versionsQuery.data?.versions ?? []
  /* eslint-enable react/exhaustive-deps */
  const [uploading, setUploading] = useState(false)
  const [buildTriggering, setBuildTriggering] = useState(false)
  const [buildStatusOpen, setBuildStatusOpen] = useState(false)
  const [buildResponse, setBuildResponse] = useState<TriggerBuildResponse | null>(null)
  // 编辑 / 删除目标按稳定 id 从最新版本列表派生「活」对象：
  // mutation 失效查询并 refetch 后弹层显示的目标随之刷新；目标被删时派生为 null，弹层自动关闭。
  const [editing, setEditingId] = useSelectedEntity(allVersions, version => version.ID)
  const [deletingVersion, setDeletingVersionId] = useSelectedEntity(allVersions, version => version.ID)
  const [deletingArtifact, setDeletingArtifact] = useState<ArtifactKey | null>(null)

  const onDeleteVersion = async () => {
    if (!deletingVersion)
      return
    try {
      await deleteVersion.mutateAsync(deletingVersion.ID)
      toast.success(t('version_deleted', { defaultValue: 'Version deleted' }))
      setDeletingVersionId(null)
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
      await deleteArtifact.mutateAsync(buildDeleteArtifactPayload(
        deletingArtifact.versionId,
        deletingArtifact.appName,
        deletingArtifact.versionStr,
        deletingArtifact.link,
      ))
      toast.success(t('artifact_deleted', { defaultValue: 'Artifact deleted' }))
      setDeletingArtifact(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  // channel 名 -> 在 channel 列表中的位次（后端已按 {sort:1,_id:1} 排序返回），
  // 用于同一 version 号内按 channel 列表顺序二级排序。取数组下标而非 c.Sort：
  // 未拖拽时（Sort 全 0）= 创建序、拖拽后 = dense sort 序，两种状态都与 channel 列表一致。
  const channelOrder = useMemo(
    () => new Map((channelsQuery.data ?? []).map((c, i) => [c.ChannelName, i] as const)),
    [channelsQuery.data],
  )
  const versions = useMemo(() => {
    const filtered = allVersions.filter((v) => {
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
    return sortVersionsByChannel(filtered, channelOrder)
  }, [allVersions, filters, channelOrder])
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
              <ArrowLeftIcon className="size-4" />
              {t('detail.back')}
            </Link>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setBuildTriggering(true)}>
              <HammerIcon className="size-4" />
              {t('build_trigger.button', { defaultValue: '构建测试包' })}
            </Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={() => setUploading(true)}>
              <PlusIcon className="size-4" />
              {t('upload', { defaultValue: 'Upload version' })}
            </Button>
          </div>
        )}
      />

      <VersionFilterBar value={filters} onChange={setFilters} />

      {versionsQuery.isPending && (
        <div className="grid gap-3">
          {['sk-1', 'sk-2', 'sk-3'].map(k => (
            <Skeleton key={k} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {versionsQuery.isError && (
        <ErrorState onRetry={() => versionsQuery.refetch()} />
      )}

      {versionsQuery.isSuccess && versions.length === 0 && (
        <EmptyState
          icon={CubeIcon}
          title={t('detail.empty.title', { defaultValue: 'No versions yet' })}
          description={t('detail.empty.description', {
            defaultValue: 'Upload your first artifact to get started.',
          })}
          action={(
            <Button onClick={() => setUploading(true)}>
              <PlusIcon className="size-4" />
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
              onEdit={() => setEditingId(v.ID)}
              onDelete={() => setDeletingVersionId(v.ID)}
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

      <TriggerBuildDialog
        open={buildTriggering}
        onOpenChange={setBuildTriggering}
        onBuildTriggered={(response) => {
          setBuildResponse(response)
          setBuildStatusOpen(true)
        }}
      />
      <BuildStatusSheet
        open={buildStatusOpen}
        onOpenChange={setBuildStatusOpen}
        correlationId={buildResponse?.correlation_id ?? ''}
        targets={buildResponse?.targets ?? []}
        runUrl={buildResponse?.run_url}
      />
      <UploadVersionDialog open={uploading} onOpenChange={setUploading} appName={appName} />
      <VersionEditDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditingId(null)}
        version={editing}
      />
      <ConfirmDialog
        open={Boolean(deletingVersion)}
        onOpenChange={open => !open && setDeletingVersionId(null)}
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
      <Card className="h-full overflow-hidden [--card-spacing:--spacing(6)]">
        <CardContent className="flex h-full min-w-0 flex-col gap-4">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex min-w-0 flex-wrap items-baseline gap-3">
                <p
                  className={cn(
                    'min-w-0 break-all text-lg font-semibold',
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
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8" aria-label={t('common:actions.edit')} onClick={onEdit}>
                <PencilSimpleIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('common:actions.delete')}
                onClick={onDelete}
              >
                <TrashIcon className="size-4 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-3">
            {changelog.length > 0 && (
              <Button
                variant="link"
                size="sm"
                className="h-auto min-w-0 max-w-full px-2 py-2 text-primary no-underline hover:no-underline"
                onClick={() => setShowChangelog(true)}
              >
                <BookOpenIcon className="size-3.5" />
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
                className="h-auto min-w-0 max-w-full px-2 py-2 text-primary no-underline hover:no-underline"
                onClick={() => setShowDownloads(true)}
              >
                <DownloadSimpleIcon className="size-3.5" />
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
              className="h-auto min-w-0 max-w-full px-2 py-2 text-primary no-underline hover:no-underline"
              onClick={() => setShowAddArtifact(true)}
            >
              <FilePlusIcon className="size-3.5" />
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
                <div className="grid min-w-0 gap-2">
                  <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
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
                      className="flex min-w-0 flex-col gap-3 border-t border-border py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
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
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto min-w-0 max-w-full px-2 py-2 text-primary no-underline hover:no-underline"
                          disabled={downloading === a.link}
                          onClick={() => onDownload(a.link)}
                        >
                          <DownloadSimpleIcon className="size-3" />
                          <span className="min-w-0 truncate">{t('actions.download', { defaultValue: 'Download' })}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t('common:actions.delete')}
                          onClick={() => onDeleteArtifact(a)}
                        >
                          <TrashIcon className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            : (
                <p className="border-t border-border pt-3 text-sm text-muted-foreground">
                  {t('detail.no_artifacts', { defaultValue: 'No artifacts attached.' })}
                </p>
              )}

        </CardContent>
      </Card>
    </li>
  )
}

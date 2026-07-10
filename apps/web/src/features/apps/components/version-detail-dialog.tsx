import type { AppVersion, ArtifactEntry } from '@ttpos/shared'
import { ArrowSquareOutIcon, BookOpenIcon, CheckIcon, CopyIcon, DownloadSimpleIcon, FilePlusIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@ttpos/ui/components/badge'
import { Button, buttonVariants } from '@ttpos/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ttpos/ui/components/dialog'
import { Separator } from '@ttpos/ui/components/separator'
import { cn } from '@ttpos/ui/lib/utils'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { formatDateTime } from '@/shared/lib/format'
import { appsApi, buildDeleteArtifactPayload } from '../api'
import { useDeleteArtifactMutation, useDeleteVersionMutation } from '../hooks'
import { AddArtifactDialog } from './add-artifact-dialog'
import { VersionEditDialog } from './version-edit-dialog'
import { getArtifactFileName, getVersionTone } from './version-ui'

interface VersionDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: AppVersion | null
}

export function VersionDetailDialog({ open, onOpenChange, version }: VersionDetailDialogProps) {
  const { t } = useTranslation(['apps', 'common'])
  const deleteVersion = useDeleteVersionMutation()
  const deleteArtifact = useDeleteArtifactMutation()
  const [editing, setEditing] = useState(false)
  const [addingArtifact, setAddingArtifact] = useState(false)
  const [deletingVersion, setDeletingVersion] = useState(false)
  const [deletingArtifact, setDeletingArtifact] = useState<ArtifactEntry | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)

  if (!version)
    return null

  const artifacts = version.Artifacts ?? []
  const changelog = version.Changelog ?? []
  const tone = getVersionTone(version)
  const statusParts = [
    version.Critical ? t('badge.critical', { defaultValue: 'Critical' }) : null,
    version.Published
      ? t('board.published', { defaultValue: 'Published' })
      : t('badge.draft', { defaultValue: 'Draft' }),
    version.Intermediate ? t('badge.intermediate', { defaultValue: 'Intermediate' }) : null,
  ].filter(Boolean)
  const updatedAt = formatDateTime(version.Updated_at)
  const statusSummary = [
    statusParts.join(' / '),
    updatedAt,
  ].filter(Boolean).join(' · ')

  const onCopy = async (link: string) => {
    try {
      setResolving(link)
      const resolvedLink = await appsApi.resolveDownloadUrl(link)
      await navigator.clipboard.writeText(resolvedLink)
      setCopied(link)
      toast.success(t('download_dialog.copied', { defaultValue: 'URL copied' }))
      setTimeout(() => setCopied(prev => (prev === link ? null : prev)), 1500)
    }
    catch {
      toast.error(t('download_dialog.copy_failed', { defaultValue: 'Could not copy URL' }))
    }
    finally {
      setResolving(null)
    }
  }

  const onDownload = async (link: string) => {
    try {
      setResolving(link)
      const resolvedLink = await appsApi.resolveDownloadUrl(link)
      window.open(resolvedLink, '_blank', 'noreferrer')
    }
    catch {
      toast.error(t('download_dialog.resolve_failed', { defaultValue: 'Could not prepare download URL' }))
    }
    finally {
      setResolving(null)
    }
  }

  const onDeleteVersion = async () => {
    try {
      await deleteVersion.mutateAsync(version.ID)
      toast.success(t('version_deleted', { defaultValue: 'Version deleted' }))
      setDeletingVersion(false)
      onOpenChange(false)
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
        version.ID,
        version.AppName,
        version.Version,
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="dialog-size-downloads" data-testid="version-detail-dialog">
          <DialogHeader className="gap-3 pr-8">
            <DialogTitle
              className={cn(
                'min-w-0 break-all text-xl font-semibold leading-tight',
                tone === 'critical' && 'text-destructive',
                tone === 'published' && 'text-primary',
                tone === 'draft' && 'text-foreground',
              )}
              data-testid="version-detail-title"
              data-version-tone={tone}
            >
              {version.Version}
            </DialogTitle>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {version.Channel && (
                <Badge
                  variant="secondary"
                  className="min-w-0 max-w-full truncate uppercase"
                  data-testid="version-detail-channel-chip"
                >
                  {version.Channel.toUpperCase()}
                </Badge>
              )}
              {version.Critical && (
                <Badge variant="destructive">
                  {t('badge.critical', { defaultValue: 'Critical' })}
                </Badge>
              )}
              <Badge variant={version.Published ? 'outline' : 'secondary'}>
                {version.Published
                  ? t('board.published', { defaultValue: 'Published' })
                  : t('badge.draft', { defaultValue: 'Draft' })}
              </Badge>
              {version.Intermediate && (
                <Badge variant="outline">
                  {t('badge.intermediate', { defaultValue: 'Intermediate' })}
                </Badge>
              )}
            </div>
            <DialogDescription data-testid="version-detail-status">
              {[version.AppName, statusSummary].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>

          <div className="dialog-scroll-area">
            <div className="flex flex-col gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-muted/30 p-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <PencilSimpleIcon data-icon="inline-start" />
                  {t('common:actions.edit')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddingArtifact(true)}>
                  <FilePlusIcon data-icon="inline-start" />
                  {t('add_artifact.button', { defaultValue: 'Add artifact' })}
                </Button>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={t('common:actions.delete')}
                  onClick={() => setDeletingVersion(true)}
                >
                  <TrashIcon />
                </Button>
              </div>

              {changelog.length > 0 && (
                <>
                  <Separator />
                  <section className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                      <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-foreground">
                        <BookOpenIcon className="size-3.5 shrink-0" />
                        <span className="truncate">{t('changelog', { defaultValue: 'Changelog' })}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {t('changelog_modal.description', {
                          count: changelog.length,
                          defaultValue: '{{count}} change set(s)',
                        })}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      {changelog.map(entry => (
                        <article
                          key={`${entry.Version}-${entry.Date}-${entry.Changes}`}
                          className="rounded-md bg-muted/30 p-3"
                        >
                          {entry.Date && <p className="text-xs text-muted-foreground">{entry.Date}</p>}
                          <div className="prose prose-sm max-w-none break-words text-sm dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground">
                            <ReactMarkdown>{entry.Changes || ''}</ReactMarkdown>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <Separator />

              <section className="flex min-w-0 flex-col gap-2">
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

                {artifacts.length === 0
                  ? (
                      <p className="rounded-md bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                        {t('detail.no_artifacts', { defaultValue: 'No artifacts attached.' })}
                      </p>
                    )
                  : (
                      <div className="flex min-w-0 flex-col">
                        {artifacts.map((artifact, index) => (
                          <Fragment key={artifact.link}>
                            {index > 0 && <Separator />}
                            <div className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <p className="flex min-w-0 flex-wrap items-center gap-1 text-sm font-medium text-foreground">
                                  <span className="break-words">
                                    {artifact.platform || t('detail.unknown_platform', { defaultValue: 'Unknown platform' })}
                                  </span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="break-words">
                                    {artifact.arch || t('detail.unknown_arch', { defaultValue: 'Unknown arch' })}
                                  </span>
                                </p>
                                <p className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                                  {getArtifactFileName(artifact)}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={resolving === artifact.link}
                                  onClick={() => onCopy(artifact.link)}
                                >
                                  {copied === artifact.link
                                    ? <CheckIcon data-icon="inline-start" />
                                    : <CopyIcon data-icon="inline-start" />}
                                  <span className="min-w-0 truncate">
                                    {t('download_dialog.copy_url', { defaultValue: 'Copy URL' })}
                                  </span>
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={resolving === artifact.link}
                                  onClick={() => onDownload(artifact.link)}
                                >
                                  <DownloadSimpleIcon data-icon="inline-start" />
                                  <span className="min-w-0 truncate">
                                    {t('actions.download', { defaultValue: 'Download' })}
                                  </span>
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon-sm"
                                  aria-label={t('delete_artifact_title', { defaultValue: 'Delete artifact?' })}
                                  onClick={() => setDeletingArtifact(artifact)}
                                >
                                  <TrashIcon />
                                </Button>
                              </div>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    )}
              </section>
            </div>
          </div>

          <DialogFooter className="sm:items-center sm:justify-between">
            <Link
              to="/applications/$appName"
              params={{ appName: version.AppName }}
              className={cn(buttonVariants({ variant: 'ghost' }), 'justify-start')}
            >
              <ArrowSquareOutIcon data-icon="inline-start" />
              {t('detail.open_full_detail', { defaultValue: 'Open app detail' })}
            </Link>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:actions.close', { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionEditDialog open={editing} onOpenChange={setEditing} version={version} />
      <AddArtifactDialog open={addingArtifact} onOpenChange={setAddingArtifact} version={version} />
      <ConfirmDialog
        open={deletingVersion}
        onOpenChange={setDeletingVersion}
        title={t('delete_version_title', { defaultValue: 'Delete version?' })}
        description={t('delete_version_description', {
          version: version.Version,
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
          name: deletingArtifact ? getArtifactFileName(deletingArtifact) : '',
          defaultValue: 'Artifact {{name}} will be removed from this version.',
        })}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteArtifact.isPending}
        onConfirm={onDeleteArtifact}
      />
    </>
  )
}

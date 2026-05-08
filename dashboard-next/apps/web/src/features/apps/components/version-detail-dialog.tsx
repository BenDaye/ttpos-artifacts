import type { AppVersion, ArtifactEntry } from '@ttpos/shared'
import { Link } from '@tanstack/react-router'
import { BookOpen, Check, Copy, Download, ExternalLink, FilePlus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { formatDateTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { appsApi } from '../api'
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
  const statusSummary = [
    statusParts.join(' / '),
    formatDateTime(version.Updated_at),
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
      await deleteArtifact.mutateAsync({
        id: version.ID,
        app_name: version.AppName,
        version: version.Version,
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="dialog-size-downloads" data-testid="version-detail-dialog">
          <DialogHeader className="gap-sm">
            <div className="flex min-w-0 flex-wrap items-baseline gap-sm pr-xl">
              <DialogTitle
                className={cn(
                  'min-w-0 break-all font-display text-lg font-semibold leading-tight',
                  tone === 'critical' && 'text-destructive',
                  tone === 'published' && 'text-primary',
                  tone === 'draft' && 'text-foreground',
                )}
                data-testid="version-detail-title"
                data-version-tone={tone}
              >
                {version.Version}
              </DialogTitle>
              {version.Channel && (
                <Badge
                  variant="secondary"
                  className="min-w-0 max-w-full shrink-0 truncate uppercase"
                  data-testid="version-detail-channel-chip"
                >
                  {version.Channel.toUpperCase()}
                </Badge>
              )}
            </div>
            <DialogDescription data-testid="version-detail-status">
              {[version.AppName, statusSummary].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="dialog-scroll-area overflow-y-auto">
            <div className="grid gap-md">
              <div className="flex min-w-0 flex-wrap items-center gap-xs border-y border-border py-sm">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" />
                  {t('common:actions.edit')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddingArtifact(true)}>
                  <FilePlus className="size-3.5" />
                  {t('add_artifact.button', { defaultValue: 'Add artifact' })}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8"
                  aria-label={t('common:actions.delete')}
                  onClick={() => setDeletingVersion(true)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              {changelog.length > 0 && (
                <section className="grid min-w-0 gap-xs">
                  <div className="flex min-w-0 items-center justify-between gap-sm text-sm">
                    <span className="inline-flex min-w-0 items-center gap-xs font-semibold text-foreground">
                      <BookOpen className="size-3.5 shrink-0" />
                      <span className="truncate">{t('changelog', { defaultValue: 'Changelog' })}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {t('changelog_modal.description', {
                        count: changelog.length,
                        defaultValue: '{{count}} change set(s)',
                      })}
                    </span>
                  </div>
                  <div className="grid min-w-0 gap-xs">
                    {changelog.map(entry => (
                      <article
                        key={`${entry.Version}-${entry.Date}-${entry.Changes}`}
                        className="rounded-md border border-border bg-muted/20 p-3"
                      >
                        {entry.Date && <p className="mb-2 text-xs text-muted-foreground">{entry.Date}</p>}
                        <div className="prose prose-sm max-w-none break-words text-sm dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground">
                          <ReactMarkdown>{entry.Changes || ''}</ReactMarkdown>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="grid min-w-0 gap-xs">
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

                {artifacts.length === 0
                  ? (
                      <p className="rounded-md border border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                        {t('detail.no_artifacts', { defaultValue: 'No artifacts attached.' })}
                      </p>
                    )
                  : artifacts.map(artifact => (
                      <div
                        key={artifact.link}
                        className="flex min-w-0 flex-col gap-sm border-t border-border py-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1 space-y-xs">
                          <p className="min-w-0 break-words text-base font-semibold text-foreground">
                            {artifact.platform || t('detail.unknown_platform', { defaultValue: 'Unknown platform' })}
                            <span className="text-muted-foreground">
                              {' '}
                              /
                              {' '}
                            </span>
                            {artifact.arch || t('detail.unknown_arch', { defaultValue: 'Unknown arch' })}
                          </p>
                          <p className="min-w-0 break-words text-sm text-muted-foreground">
                            {getArtifactFileName(artifact)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-xs">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-sm text-sm"
                            disabled={resolving === artifact.link}
                            onClick={() => onCopy(artifact.link)}
                          >
                            {copied === artifact.link
                              ? <Check className="size-3.5" />
                              : <Copy className="size-3.5" />}
                            {t('download_dialog.copy_url', { defaultValue: 'Copy URL' })}
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-sm text-sm"
                            disabled={resolving === artifact.link}
                            onClick={() => onDownload(artifact.link)}
                          >
                            <Download className="size-3.5" />
                            {t('actions.download', { defaultValue: 'Download' })}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('delete_artifact_title', { defaultValue: 'Delete artifact?' })}
                            onClick={() => setDeletingArtifact(artifact)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
              </section>
            </div>
          </DialogBody>

          <DialogFooter>
            <Link
              to="/applications/$appName"
              params={{ appName: version.AppName }}
              className={buttonVariants({ variant: 'outline' })}
            >
              <ExternalLink className="size-4" />
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

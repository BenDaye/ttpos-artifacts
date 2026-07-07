import type { ArtifactEntry } from '@ttpos/shared'
import { Badge } from '@ttpos/ui/components/badge'
import { Button } from '@ttpos/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ttpos/ui/components/dialog'
import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { appsApi } from '../api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  appName: string
  versionStr: string
  artifacts: ArtifactEntry[]
}

export function DownloadArtifactsDialog({
  open,
  onOpenChange,
  appName,
  versionStr,
  artifacts,
}: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const [copied, setCopied] = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-size-downloads">
        <DialogHeader>
          <DialogTitle>
            {t('download_dialog.title', { defaultValue: 'Download artifacts' })}
          </DialogTitle>
          <DialogDescription>
            {`${appName} · v${versionStr}`}
            {artifacts.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                (
                {t('download_dialog.count', {
                  count: artifacts.length,
                  defaultValue: '{{count}} artifact(s)',
                })}
                )
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div>
          {artifacts.length === 0
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('detail.no_artifacts', { defaultValue: 'No artifacts attached.' })}
                </p>
              )
            : (
                <ul className="dialog-scroll-area space-y-2">
                  {artifacts.map(a => (
                    <li
                      key={a.link}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{a.platform || '—'}</Badge>
                        <Badge variant="outline">{a.arch || '—'}</Badge>
                        {a.package && <Badge variant="secondary">{a.package}</Badge>}
                        <span className="break-all font-mono text-muted-foreground">
                          {a.link.split('/').pop()}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          disabled={resolving === a.link}
                          onClick={() => onCopy(a.link)}
                        >
                          {copied === a.link
                            ? <Check className="size-3" />
                            : <Copy className="size-3" />}
                          {t('download_dialog.copy_url', { defaultValue: 'Copy URL' })}
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          disabled={resolving === a.link}
                          onClick={() => onDownload(a.link)}
                        >
                          <Download className="size-3" />
                          {t('actions.download', { defaultValue: 'Download' })}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.close', { defaultValue: 'Close' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

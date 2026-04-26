import type { ArtifactEntry } from '@ttpos/shared'
import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { cn } from '@/shared/lib/utils'

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

  const onCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(link)
      toast.success(t('download_dialog.copied', { defaultValue: 'URL copied' }))
      setTimeout(() => setCopied(prev => (prev === link ? null : prev)), 1500)
    }
    catch {
      toast.error(t('download_dialog.copy_failed', { defaultValue: 'Could not copy URL' }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,42rem)]">
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
        <DialogBody>
          {artifacts.length === 0
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('detail.no_artifacts', { defaultValue: 'No artifacts attached.' })}
                </p>
              )
            : (
                <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
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
                          onClick={() => onCopy(a.link)}
                        >
                          {copied === a.link
                            ? <Check className="size-3" />
                            : <Copy className="size-3" />}
                          {t('download_dialog.copy_url', { defaultValue: 'Copy URL' })}
                        </Button>
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className={cn(buttonVariants({ size: 'sm' }), 'h-7 px-2.5 text-xs')}
                        >
                          <Download className="size-3" />
                          {t('actions.download', { defaultValue: 'Download' })}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.close', { defaultValue: 'Close' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

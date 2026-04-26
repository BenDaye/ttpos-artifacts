import type { ArtifactEntry } from '@ttpos/shared'
import { Copy, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
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

interface PlatformGroup {
  platform: string
  items: ArtifactEntry[]
}

function groupByPlatform(artifacts: ArtifactEntry[]): PlatformGroup[] {
  const map = new Map<string, ArtifactEntry[]>()
  artifacts.forEach((a) => {
    const key = a.platform || '—'
    const list = map.get(key) ?? []
    list.push(a)
    map.set(key, list)
  })
  return Array.from(map.entries()).map(([platform, items]) => ({ platform, items }))
}

export function DownloadArtifactsDialog({ open, onOpenChange, appName, versionStr, artifacts }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const groups = groupByPlatform(artifacts)

  const onCopy = (link: string) => {
    void navigator.clipboard.writeText(link)
    toast.success(t('common:actions.copied', { defaultValue: 'Copied' }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,42rem)]">
        <DialogHeader>
          <DialogTitle>
            {appName}
            {' '}
            ·
            {' '}
            {versionStr}
            {' '}
            ·
            {' '}
            {t('download_dialog.title', { defaultValue: 'Download artifacts' })}
          </DialogTitle>
          <DialogDescription>
            {t('download_dialog.description', {
              count: artifacts.length,
              defaultValue: 'Pick the artifact for your platform/architecture ({{count}} total).',
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {artifacts.length === 0
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('detail.no_artifacts')}
                </p>
              )
            : (
                <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                  {groups.map(group => (
                    <section key={group.platform}>
                      <header className="mb-2 flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{group.platform}</h4>
                        <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
                      </header>
                      <ul className="space-y-1.5">
                        {group.items.map(a => (
                          <li
                            key={a.link}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2"
                          >
                            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                              <Badge variant="outline">{a.arch || '—'}</Badge>
                              <span className="truncate font-mono text-muted-foreground">
                                {a.package || a.link.split('/').pop()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={t('common:actions.copy', { defaultValue: 'Copy' })}
                                onClick={() => onCopy(a.link)}
                              >
                                <Copy className="size-3.5" />
                              </Button>
                              <a
                                href={a.link}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 px-2.5 text-xs')}
                              >
                                <Download className="size-3" />
                                {t('actions.download', { defaultValue: 'Download' })}
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

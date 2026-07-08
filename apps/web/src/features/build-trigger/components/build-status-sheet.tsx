import type { BuildTarget } from '../api'
import { Badge } from '@ttpos/ui/components/badge'
import { Button } from '@ttpos/ui/components/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ttpos/ui/components/sheet'
import { Download, ExternalLink, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { packageLabel } from '../constants'
import { BUILD_TIMEOUT_MS, useBuildCompletion } from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  correlationId: string
  targets: BuildTarget[]
  runUrl?: string
}

export function BuildStatusSheet({
  open,
  onOpenChange,
  correlationId,
  targets,
  runUrl,
}: Props) {
  const { t } = useTranslation(['apps', 'common'])

  // Track the last correlation id for which the timeout fired.
  // If it matches the current correlationId, the build has timed out.
  const [timedOutId, setTimedOutId] = useState<string | null>(null)
  const isTimedOut = timedOutId === correlationId && Boolean(correlationId)

  // Schedule a 30-minute timeout whenever the correlationId changes.
  // setState is only called inside the timer callback, never synchronously.
  useEffect(() => {
    if (!correlationId)
      return
    const timer = setTimeout(() => {
      setTimedOutId(correlationId)
    }, BUILD_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [correlationId])

  const [downloading, setDownloading] = useState<string | null>(null)

  const { results, allSettled, doneCount } = useBuildCompletion(
    correlationId,
    targets,
    open && Boolean(correlationId),
    isTimedOut,
  )

  function handleDownload(appName: string) {
    setDownloading(appName)
    // The /search API doesn't return a direct download link for the new version.
    // We notify the user to download from the version list.
    toast.info(t('build_trigger.status_done_hint', { defaultValue: '版本已构建完成，请前往版本列表下载。' }))
    setDownloading(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {t('build_trigger.status_title', { defaultValue: '构建状态' })}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span>
              {t('build_trigger.status_progress', {
                done: doneCount,
                total: targets.length,
                defaultValue: '{{done}} / {{total}} 完成',
              })}
            </span>
            {!allSettled && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {runUrl && (
              <a
                href={runUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
              >
                <ExternalLink className="size-3" />
                {t('build_trigger.view_run', { defaultValue: '查看 Actions run' })}
              </a>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {results.map((result) => {
              const { target, status } = result
              const displayName = packageLabel(target.package)
              const key = `${target.package}-${target.platform}`

              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {displayName}
                      <span className="ml-1.5 text-muted-foreground">
                        (
                        {target.package}
                        )
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">{target.platform}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {status === 'done' && (
                      <>
                        <Badge className="bg-green-600 text-white hover:bg-green-700">
                          {t('build_trigger.status_done', { defaultValue: '完成' })}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={downloading === target.app_name}
                          onClick={() => handleDownload(target.app_name)}
                        >
                          <Download className="size-3.5" />
                          {t('build_trigger.download', { defaultValue: '下载' })}
                        </Button>
                      </>
                    )}
                    {status === 'building' && (
                      <Badge variant="secondary">
                        {t('build_trigger.status_building', { defaultValue: '构建中' })}
                      </Badge>
                    )}
                    {status === 'timeout' && (
                      <>
                        <Badge variant="destructive">
                          {t('build_trigger.status_failed', { defaultValue: '超时' })}
                        </Badge>
                        {runUrl && (
                          <a
                            href={runUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="size-3" />
                            {t('build_trigger.view_run', { defaultValue: '查看 Actions run' })}
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  )
}

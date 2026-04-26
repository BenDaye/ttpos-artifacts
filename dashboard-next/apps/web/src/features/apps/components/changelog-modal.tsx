import type { ChangelogEntry } from '@ttpos/shared'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  appName: string
  versionStr: string
  entries: ChangelogEntry[]
}

export function ChangelogModal({ open, onOpenChange, appName, versionStr, entries }: Props) {
  const { t } = useTranslation('apps')
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
            {t('changelog')}
          </DialogTitle>
          <DialogDescription>
            {t('changelog_count', { count: entries.length, defaultValue: '{{count}} change set(s)' })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {entries.length === 0
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t('changelog_empty', { defaultValue: 'No changelog entries.' })}
                </p>
              )
            : (
                <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                  {entries.map((entry, i) => (
                    <article
                      key={`${entry.Version}-${entry.Date}-${i}`}
                      className="rounded-md border border-border bg-muted/30 p-4"
                    >
                      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold">{entry.Version}</h3>
                        {entry.Date && (
                          <time className="text-xs text-muted-foreground">{entry.Date}</time>
                        )}
                      </header>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{entry.Changes ?? ''}</ReactMarkdown>
                      </div>
                    </article>
                  ))}
                </div>
              )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

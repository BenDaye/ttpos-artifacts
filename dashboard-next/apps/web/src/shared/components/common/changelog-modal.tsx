import type { ChangelogEntry } from '@ttpos/shared'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'

interface ChangelogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: ChangelogEntry[]
  title?: ReactNode
  description?: ReactNode
}

interface Group {
  version: string
  items: ChangelogEntry[]
}

function groupByVersion(entries: ChangelogEntry[]): Group[] {
  const map = new Map<string, ChangelogEntry[]>()
  for (const entry of entries) {
    const key = entry.Version || ''
    const list = map.get(key)
    if (list) {
      list.push(entry)
    }
    else {
      map.set(key, [entry])
    }
  }
  return Array.from(map.entries()).map(([version, items]) => ({ version, items }))
}

export function ChangelogModal({
  open,
  onOpenChange,
  entries,
  title,
  description,
}: ChangelogModalProps) {
  const { t } = useTranslation(['apps', 'common'])
  const groups = useMemo(() => groupByVersion(entries), [entries])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,40rem)]">
        <DialogHeader>
          <DialogTitle>{title ?? t('changelog', { defaultValue: 'Changelog' })}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="max-h-[60vh] overflow-y-auto">
          {groups.length === 0
            ? (
                <p className="text-sm text-muted-foreground">
                  {t('changelog_modal.empty', { defaultValue: 'No changelog entries.' })}
                </p>
              )
            : (
                <div className="space-y-4">
                  {groups.map(group => (
                    <section key={group.version || 'unversioned'} className="space-y-2">
                      <header className="flex flex-wrap items-baseline gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {group.version || t('changelog_modal.unversioned', { defaultValue: 'Unversioned' })}
                        </Badge>
                      </header>
                      <div className="space-y-3">
                        {group.items.map((item, idx) => (
                          <article
                            key={`${item.Version}-${item.Date}-${idx}`}
                            className="rounded-md border border-border bg-muted/20 p-3"
                          >
                            {item.Date && (
                              <p className="mb-2 text-xs text-muted-foreground">{item.Date}</p>
                            )}
                            <div className="prose prose-sm max-w-none break-words text-sm dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground">
                              <ReactMarkdown>{item.Changes || ''}</ReactMarkdown>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
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

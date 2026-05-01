import type { ComponentType, ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 max-w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-lg text-center sm:p-12',
        className,
      )}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="max-w-full break-words text-base font-medium text-foreground">{title}</h3>
      {description && (
        <p className="max-w-full break-words text-sm text-muted-foreground sm:max-w-md">{description}</p>
      )}
      {action && <div className="mt-1 flex max-w-full flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

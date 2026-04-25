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
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

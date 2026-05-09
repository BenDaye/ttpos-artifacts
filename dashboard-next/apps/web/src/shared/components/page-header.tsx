import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="grid w-full min-w-0 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  )
}

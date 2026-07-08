import type { ComponentType, ReactNode } from 'react'
import { TrayIcon } from '@phosphor-icons/react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@ttpos/ui/components/empty'
import { cn } from '@ttpos/ui/lib/utils'

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  iconClassName?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = TrayIcon,
  iconClassName,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Empty className={cn('border border-dashed border-border p-6 sm:p-12', className)}>
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-full [&_svg]:size-6"
        >
          <Icon className={iconClassName} />
        </EmptyMedia>
        <EmptyTitle className="text-base font-medium text-foreground">{title}</EmptyTitle>
        {description && (
          <EmptyDescription className="min-w-[200px]">{description}</EmptyDescription>
        )}
      </EmptyHeader>
      {action && (
        <EmptyContent className="mt-1">
          {action}
        </EmptyContent>
      )}
    </Empty>
  )
}

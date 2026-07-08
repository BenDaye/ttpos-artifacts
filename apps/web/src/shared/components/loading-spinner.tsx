import { CircleNotchIcon } from '@phosphor-icons/react'
import { cn } from '@ttpos/ui/lib/utils'

export function LoadingSpinner({
  fullScreen = false,
  className,
}: {
  fullScreen?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center text-muted-foreground',
        fullScreen ? 'min-h-svh' : 'p-6',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <CircleNotchIcon className="size-6 animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

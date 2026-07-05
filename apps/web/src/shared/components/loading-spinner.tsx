import { cn } from '@ttpos/ui/lib/utils'
import { Loader2 } from 'lucide-react'

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
      <Loader2 className="size-6 animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@ttpos/ui/lib/utils'

export function Input({ className, type = 'text', ...props }: ComponentPropsWithoutRef<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-pill border border-input bg-transparent px-5 py-3 text-base shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

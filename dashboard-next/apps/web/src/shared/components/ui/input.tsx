import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/shared/lib/utils'

export function Input({ className, type = 'text', ...props }: ComponentPropsWithoutRef<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

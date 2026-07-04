import type { ComponentPropsWithoutRef } from 'react'
import { ToggleGroup as BaseToggleGroup } from '@base-ui-components/react/toggle-group'
import { cn } from '@/shared/lib/utils'

export function ToggleGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseToggleGroup>) {
  return (
    <BaseToggleGroup
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-pill border border-input bg-background p-0.5',
        className,
      )}
      {...props}
    />
  )
}

export function ToggleGroupItem({
  className,
  ...props
}: ComponentPropsWithoutRef<'button'> & { value: string }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 min-w-0 items-center justify-center gap-2 rounded-pill px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-apple-primary-focus data-pressed:hover:text-primary-foreground',
        className,
      )}
      {...props}
    />
  )
}

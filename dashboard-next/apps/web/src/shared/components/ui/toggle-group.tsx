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
        'inline-flex items-center gap-0.5 rounded-md border border-input bg-background p-0.5',
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
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-[pressed=true]:bg-accent data-[pressed=true]:text-accent-foreground',
        className,
      )}
      {...props}
    />
  )
}

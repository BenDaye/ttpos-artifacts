import type { ComponentPropsWithoutRef } from 'react'
import { Switch as BaseSwitch } from '@base-ui-components/react/switch'
import { cn } from '@/shared/lib/utils'

export function Switch({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseSwitch.Root>) {
  return (
    <BaseSwitch.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[unchecked]:bg-input',
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[checked]:translate-x-4 data-[unchecked]:translate-x-0',
        )}
      />
    </BaseSwitch.Root>
  )
}

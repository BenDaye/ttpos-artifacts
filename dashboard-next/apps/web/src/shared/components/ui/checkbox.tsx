import type { ComponentPropsWithoutRef } from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui-components/react/checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function Checkbox({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root
      className={cn(
        'peer size-4 shrink-0 rounded-sm border border-input shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

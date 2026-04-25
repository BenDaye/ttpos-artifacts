import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Popover as BasePopover } from '@base-ui-components/react/popover'
import { cn } from '@/shared/lib/utils'

export const Popover = BasePopover.Root
export const PopoverTrigger = BasePopover.Trigger

export function PopoverContent({
  className,
  children,
  sideOffset = 6,
  align,
  ...props
}: ComponentPropsWithoutRef<typeof BasePopover.Popup> & {
  children: ReactNode
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner sideOffset={sideOffset} align={align}>
        <BasePopover.Popup
          className={cn(
            'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden',
            'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
            'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
            'transition-all duration-100',
            className,
          )}
          {...props}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

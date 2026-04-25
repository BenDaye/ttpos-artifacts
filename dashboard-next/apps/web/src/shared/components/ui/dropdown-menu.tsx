import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Menu as BaseMenu } from '@base-ui-components/react/menu'
import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export const DropdownMenu = BaseMenu.Root
export const DropdownMenuTrigger = BaseMenu.Trigger
export const DropdownMenuGroup = BaseMenu.Group

export function DropdownMenuContent({
  className,
  children,
  sideOffset = 6,
  align,
  ...props
}: ComponentPropsWithoutRef<typeof BaseMenu.Popup> & {
  children: ReactNode
  sideOffset?: number
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={sideOffset} align={align}>
        <BaseMenu.Popup
          className={cn(
            'z-50 min-w-44 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden',
            'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
            'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
            'transition-all duration-100',
            className,
          )}
          {...props}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseMenu.Item>) {
  return (
    <BaseMenu.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseMenu.Separator>) {
  return (
    <BaseMenu.Separator
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentPropsWithoutRef<typeof BaseMenu.CheckboxItem> & {
  children: ReactNode
  checked?: boolean
}) {
  return (
    <BaseMenu.CheckboxItem
      checked={checked}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <BaseMenu.CheckboxItemIndicator>
          <Check className="size-3.5" />
        </BaseMenu.CheckboxItemIndicator>
      </span>
      {children}
    </BaseMenu.CheckboxItem>
  )
}

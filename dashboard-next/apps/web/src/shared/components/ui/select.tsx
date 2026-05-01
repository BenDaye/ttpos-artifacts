import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Select as BaseSelect } from '@base-ui-components/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export const Select = BaseSelect.Root
export const SelectGroup = BaseSelect.Group
export const SelectGroupLabel = BaseSelect.GroupLabel

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof BaseSelect.Trigger> & { children: ReactNode }) {
  return (
    <BaseSelect.Trigger
      className={cn(
        'flex h-11 w-full items-center justify-between gap-2 rounded-pill border border-input bg-transparent px-5 py-3 text-base shadow-none transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon>
        <ChevronDown className="size-4 opacity-60" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

export function SelectValue(props: ComponentPropsWithoutRef<typeof BaseSelect.Value>) {
  return <BaseSelect.Value {...props} />
}

export function SelectContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof BaseSelect.Popup> & { children: ReactNode }) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={4}>
        <BaseSelect.Popup
          className={cn(
            'select-popup-available z-50 overflow-y-auto rounded-md border bg-popover p-xs text-popover-foreground shadow-none outline-hidden',
            'data-starting:opacity-0 data-starting:scale-95',
            'data-ending:opacity-0 data-ending:scale-95',
            'transition-all duration-100',
            className,
          )}
          {...props}
        >
          {children}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof BaseSelect.Item> & { children: ReactNode }) {
  return (
    <BaseSelect.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-2 pl-8 pr-2 text-sm outline-hidden transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <BaseSelect.ItemIndicator>
          <Check className="size-3.5" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  )
}

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
        'flex h-11 w-full min-w-0 items-center justify-between gap-sm rounded-pill border border-input bg-transparent px-5 py-3 text-base shadow-none transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon>
        <ChevronDown className="size-4 opacity-60" data-testid="select-chevron" />
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
    <BaseSelect.Positioner sideOffset={4}>
      <BaseSelect.Popup
        className={cn(
          'select-popup-available select-popup-width z-50 overflow-y-auto rounded-md border bg-popover p-xs text-popover-foreground shadow-none outline-hidden',
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
        'flex min-w-0 cursor-pointer select-none items-center gap-sm rounded-sm px-sm py-xs text-sm outline-hidden transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        <BaseSelect.ItemIndicator>
          <Check className="size-3.5" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText className="min-w-0 truncate">{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  )
}

export interface SelectFieldOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface SelectFieldBaseProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectFieldOption[]
  placeholder?: ReactNode
  disabled?: boolean
  required?: boolean
  name?: string
  id?: string
  className?: string
  triggerClassName?: string
  contentClassName?: string
}

type SelectFieldProps = SelectFieldBaseProps & {
  'aria-label'?: string
}

export function SelectField({
  value,
  onValueChange,
  options,
  placeholder = '—',
  disabled,
  required,
  name,
  id,
  className,
  triggerClassName,
  contentClassName,
  'aria-label': ariaLabel,
}: SelectFieldProps) {
  const selected = options.find(option => option.value === value)

  return (
    <div className={cn('min-w-0', className)}>
      <Select
        value={value}
        onValueChange={next => onValueChange(typeof next === 'string' ? next : '')}
        disabled={disabled}
        required={required}
        name={name}
        id={id}
      >
        <SelectTrigger aria-label={ariaLabel} className={triggerClassName}>
          <SelectValue>
            {() => (
              <span className={cn('min-w-0 truncate', !selected && 'text-muted-foreground')} data-testid="select-value-text">
                {selected?.label ?? placeholder}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          <SelectItem value="">
            {placeholder}
          </SelectItem>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

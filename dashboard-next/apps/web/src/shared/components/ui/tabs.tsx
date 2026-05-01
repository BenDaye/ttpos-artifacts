import type { ComponentPropsWithoutRef } from 'react'
import { Tabs as BaseTabs } from '@base-ui-components/react/tabs'
import { cn } from '@/shared/lib/utils'

export const Tabs = BaseTabs.Root

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      className={cn(
        'relative inline-flex h-11 items-center justify-center rounded-pill bg-muted p-xs text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        'relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-pill px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-selected:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function TabsIndicator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseTabs.Indicator>) {
  return (
    <BaseTabs.Indicator
      className={cn(
        'tabs-indicator absolute z-0 rounded-pill bg-background shadow-none transition-all duration-200',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseTabs.Panel>) {
  return (
    <BaseTabs.Panel
      className={cn(
        'mt-3 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    />
  )
}

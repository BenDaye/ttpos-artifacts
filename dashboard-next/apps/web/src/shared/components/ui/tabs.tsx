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
        'relative inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
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
        'relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[selected]:text-foreground',
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
        'absolute left-(--active-tab-left) top-(--active-tab-top) z-0 h-(--active-tab-height) w-(--active-tab-width) rounded-md bg-background shadow-sm transition-all duration-200',
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

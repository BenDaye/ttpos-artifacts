import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/shared/lib/utils'

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

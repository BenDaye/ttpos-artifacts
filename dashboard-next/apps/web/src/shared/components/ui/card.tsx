import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/shared/lib/utils'

export function Card({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />
}

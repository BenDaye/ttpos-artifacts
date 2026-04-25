import type { ComponentPropsWithoutRef } from 'react'
import { Avatar as BaseAvatar } from '@base-ui-components/react/avatar'
import { cn } from '@/shared/lib/utils'

export function Avatar({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseAvatar.Root>) {
  return (
    <BaseAvatar.Root
      className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

export function AvatarImage({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseAvatar.Image>) {
  return (
    <BaseAvatar.Image className={cn('aspect-square size-full object-cover', className)} {...props} />
  )
}

export function AvatarFallback({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseAvatar.Fallback>) {
  return (
    <BaseAvatar.Fallback
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

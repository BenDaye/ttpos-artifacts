import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import { cn } from '@ttpos/ui/lib/utils'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogClose = BaseDialog.Close

export function DialogContent({
  className,
  children,
  hideCloseButton = false,
  ...props
}: ComponentPropsWithoutRef<typeof BaseDialog.Popup> & {
  children: ReactNode
  hideCloseButton?: boolean
}) {
  const { t } = useTranslation('common')
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop
        className={cn(
          'fixed inset-0 z-50 bg-apple-surface-black/60 backdrop-blur-sm',
          'data-starting:opacity-0 data-ending:opacity-0',
          'transition-opacity duration-150',
        )}
      />
      <BaseDialog.Popup
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'dialog-size-default rounded-lg border border-border bg-card text-card-foreground shadow-none',
          'data-starting:scale-95 data-starting:opacity-0',
          'data-ending:scale-95 data-ending:opacity-0',
          'transition-all duration-150',
          className,
        )}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <BaseDialog.Close
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('actions.close')}
          >
            <X className="size-4" />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

export function DialogHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex flex-col gap-xs p-lg pb-xs pr-xl', className)} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-xs p-lg pt-0 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn('text-lg font-semibold leading-none', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export function DialogBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('px-lg pb-xs', className)} {...props} />
}

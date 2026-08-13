import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@ttpos/ui/components/alert-dialog'
import { Spinner } from '@ttpos/ui/components/spinner'
import { useTranslation } from 'react-i18next'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')
  return (
    <AlertDialog open={open} onOpenChange={next => !loading && onOpenChange(next)}>
      <AlertDialogContent className="dialog-size-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" disabled={loading}>
            {cancelLabel ?? t('actions.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => {
              void onConfirm()
            }}
            disabled={loading}
          >
            {loading && <Spinner />}
            {confirmLabel ?? t('actions.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

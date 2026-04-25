import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,28rem)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && (
          <DialogBody>
            <p className="text-sm text-muted-foreground">{description}</p>
          </DialogBody>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => {
              void onConfirm()
            }}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

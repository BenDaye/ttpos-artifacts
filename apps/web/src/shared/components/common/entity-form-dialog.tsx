import type { ReactNode } from 'react'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { Button } from '@ttpos/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ttpos/ui/components/dialog'
import { useTranslation } from 'react-i18next'

interface EntityFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  submitLabel?: ReactNode
  cancelLabel?: ReactNode
  loading?: boolean
  onSubmit: () => void | Promise<void>
  children: ReactNode
}

export function EntityFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel,
  loading = false,
  onSubmit,
  children,
}: EntityFormDialogProps) {
  const { t } = useTranslation('common')
  return (
    <Dialog open={open} onOpenChange={next => !loading && onOpenChange(next)}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void onSubmit()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="dialog-scroll-area">{children}</div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel ?? t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <CircleNotchIcon className="size-4 animate-spin" />}
              {submitLabel ?? t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

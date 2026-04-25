import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'

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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <DialogBody>{children}</DialogBody>
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
              {loading && <Loader2 className="size-4 animate-spin" />}
              {submitLabel ?? t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

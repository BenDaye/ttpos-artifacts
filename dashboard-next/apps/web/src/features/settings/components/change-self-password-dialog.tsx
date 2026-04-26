import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useChangePasswordMutation } from '@/features/auth/hooks'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { HttpError } from '@/shared/lib/http'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangeSelfPasswordDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const change = useChangePasswordMutation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    if (open) {
      setPassword('')
      setConfirm('')
    }
  }, [open])

  const onSubmit = async () => {
    if (password.length < 8) {
      toast.error(t('users.password_length', { defaultValue: 'Password must be at least 8 characters' }))
      return
    }
    if (password !== confirm) {
      toast.error(t('users.password_mismatch', { defaultValue: 'Passwords do not match' }))
      return
    }
    try {
      await change.mutateAsync({ password })
      toast.success(t('users.password_changed', { defaultValue: 'Password changed' }))
      onOpenChange(false)
    }
    catch (err) {
      const status = err instanceof HttpError ? err.status : 0
      if (status === 404 || status === 405 || status === 501) {
        toast.error(
          t('users.self_change_unsupported', {
            defaultValue: 'Self-service password change is not enabled. Please contact an administrator.',
          }),
          { duration: 6000 },
        )
        return
      }
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('users.self_change_title', { defaultValue: 'Change my password' })}
      description={t('users.self_change_description', {
        defaultValue: 'Update the password used to sign in to ZEHub.',
      })}
      loading={change.isPending}
      onSubmit={onSubmit}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="self-password">{t('users.new_password', { defaultValue: 'New password' })}</Label>
          <Input
            id="self-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="self-password-confirm">
            {t('users.confirm_password', { defaultValue: 'Confirm password' })}
          </Label>
          <Input
            id="self-password-confirm"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
      </div>
    </EntityFormDialog>
  )
}

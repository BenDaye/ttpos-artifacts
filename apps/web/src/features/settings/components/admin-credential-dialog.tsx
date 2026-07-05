import type { UserProfile } from '@ttpos/shared'
import { Input } from '@ttpos/ui/components/input'
import { Label } from '@ttpos/ui/components/label'
import { PasswordInput } from '@ttpos/ui/components/password-input'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { useAdminUpdateMutation } from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile | null
}

export function AdminCredentialDialog({ open, onOpenChange, user }: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const update = useAdminUpdateMutation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  /* eslint-disable react/set-state-in-effect -- 弹窗打开时重置表单字段,刻意的 prop-sync,非渲染期副作用误用 */
  useEffect(() => {
    if (open) {
      setUsername(user?.username ?? '')
      setPassword('')
    }
  }, [open, user])
  /* eslint-enable react/set-state-in-effect */

  const onSubmit = async () => {
    if (!user) {
      return
    }
    if (!username.trim() || !password) {
      toast.error(t('users.password_length', { defaultValue: 'Username and password required' }))
      return
    }
    try {
      await update.mutateAsync({
        id: user.id,
        username: username.trim(),
        password,
      })
      toast.success(t('users.updated', { defaultValue: 'Updated' }))
      onOpenChange(false)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('users.admin_edit_title', { defaultValue: 'Update admin credentials' })}
      description={t('users.admin_edit_description', {
        defaultValue: 'Both username and password are required for an admin update.',
      })}
      loading={update.isPending}
      onSubmit={onSubmit}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="admin-username">{t('users.username', { defaultValue: 'Username' })}</Label>
          <Input
            id="admin-username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password">{t('users.new_password', { defaultValue: 'New password' })}</Label>
          <PasswordInput
            id="admin-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
      </div>
    </EntityFormDialog>
  )
}

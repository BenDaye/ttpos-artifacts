import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useAdminUpdateMutation } from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
  username: string
}

export function UserCredentialDialog({ open, onOpenChange, userId, username }: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const update = useAdminUpdateMutation()
  const [name, setName] = useState(username)
  const [password, setPassword] = useState('')

  useEffect(() => {
    setName(username)
    setPassword('')
  }, [username, open])

  const onSubmit = async () => {
    if (!userId) {
      return
    }
    const payload: { id: string, username?: string, password?: string } = { id: userId }
    if (name && name !== username) {
      payload.username = name
    }
    if (password) {
      payload.password = password
    }
    if (!payload.username && !payload.password) {
      onOpenChange(false)
      return
    }
    try {
      await update.mutateAsync(payload)
      toast.success(t('users.updated', { defaultValue: 'User updated' }))
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
      title={t('users.edit_title', { defaultValue: 'Edit user' })}
      description={t('users.edit_description', { defaultValue: 'Update credentials. Leave password empty to keep it.' })}
      loading={update.isPending}
      onSubmit={onSubmit}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="user-username">{t('common:actions.username', { defaultValue: 'Username' })}</Label>
          <Input
            id="user-username"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-password">{t('users.new_password', { defaultValue: 'New password' })}</Label>
          <Input
            id="user-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>
    </EntityFormDialog>
  )
}

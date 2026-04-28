import type { TeamUser, TeamUserPermissions } from '@ttpos/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppsListQuery } from '@/features/apps/hooks'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { useChannelsQuery } from '@/features/channels/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useCreateUserMutation, useUpdateUserMutation } from '../hooks'
import {
  coerceAllowedValuesToIds,
  makeEmptyPermissions,
  makePermissionItems,
  normalizePermissions,
  PermissionMatrix,
} from './permission-matrix'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: TeamUser | null
}

export function TeamUserFormDialog({ open, onOpenChange, user }: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const create = useCreateUserMutation()
  const update = useUpdateUserMutation()
  const apps = useAppsListQuery({ page: 1, limit: 200 })
  const channels = useChannelsQuery()
  const platforms = usePlatformsQuery()
  const archs = useArchitecturesQuery()
  const editing = Boolean(user)
  const mutation = editing ? update : create
  const appItems = makePermissionItems(apps.data?.apps, app => app.ID, app => app.AppName)
  const channelItems = makePermissionItems(channels.data, channel => channel.ID, channel => channel.ChannelName)
  const platformItems = makePermissionItems(platforms.data, platform => platform.ID, platform => platform.PlatformName)
  const archItems = makePermissionItems(archs.data, arch => arch.ID, arch => arch.ArchID)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [perms, setPerms] = useState<TeamUserPermissions>(() => makeEmptyPermissions())

  useEffect(() => {
    if (open) {
      setUsername(user?.username ?? '')
      setPassword('')
      setPerms(user ? normalizePermissions(user.permissions) : makeEmptyPermissions())
    }
  }, [open, user])

  const onSubmit = async () => {
    const u = username.trim()
    if (!u) {
      toast.error(t('common:states.error'))
      return
    }
    if (!editing && password.length < 8) {
      toast.error(t('users.password_length', { defaultValue: 'Password must be at least 8 characters' }))
      return
    }
    const permissions: TeamUserPermissions = {
      ...perms,
      Apps: { ...perms.Apps, Allowed: coerceAllowedValuesToIds(perms.Apps.Allowed, appItems) },
      Channels: { ...perms.Channels, Allowed: coerceAllowedValuesToIds(perms.Channels.Allowed, channelItems) },
      Platforms: { ...perms.Platforms, Allowed: coerceAllowedValuesToIds(perms.Platforms.Allowed, platformItems) },
      Archs: { ...perms.Archs, Allowed: coerceAllowedValuesToIds(perms.Archs.Allowed, archItems) },
    }
    try {
      if (editing && user) {
        await update.mutateAsync({
          id: user.id,
          username: u,
          password: password || undefined,
          permissions,
        })
      }
      else {
        await create.mutateAsync({
          username: u,
          password,
          permissions,
        })
      }
      toast.success(t(editing ? 'users.updated' : 'users.created', { defaultValue: 'Saved' }))
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
      title={editing
        ? t('users.edit_title', { defaultValue: 'Edit team user' })
        : t('users.create_title', { defaultValue: 'Create team user' })}
      description={t('users.form_description', {
        defaultValue: 'Team users have scoped permissions across apps, channels, platforms and architectures.',
      })}
      loading={mutation.isPending}
      onSubmit={onSubmit}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="user-username">{t('users.username', { defaultValue: 'Username' })}</Label>
            <Input
              id="user-username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">
              {editing
                ? t('users.new_password', { defaultValue: 'New password (leave blank to keep)' })
                : t('users.password', { defaultValue: 'Password' })}
            </Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={editing ? '••••••••' : ''}
              autoComplete="new-password"
            />
          </div>
        </div>
        <PermissionMatrix
          value={perms}
          onChange={setPerms}
          appItems={appItems}
        />
      </div>
    </EntityFormDialog>
  )
}

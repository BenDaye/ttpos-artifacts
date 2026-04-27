import type { TeamUserPermissions } from '@ttpos/shared'
import { useTranslation } from 'react-i18next'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { useChannelsQuery } from '@/features/channels/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'
import { Checkbox } from '@/shared/components/ui/checkbox'

export function makeEmptyPermissions(): TeamUserPermissions {
  return {
    Apps: { Create: false, Delete: false, Edit: false, Download: false, Upload: false, Allowed: [] },
    Channels: { Create: false, Delete: false, Edit: false, Allowed: [] },
    Platforms: { Create: false, Delete: false, Edit: false, Allowed: [] },
    Archs: { Create: false, Delete: false, Edit: false, Allowed: [] },
  }
}

// 后端 Allowed 字段为 nil slice 时会被序列化为 null，需要在前端归一化为空数组
export function normalizePermissions(perms?: TeamUserPermissions | null): TeamUserPermissions {
  const empty = makeEmptyPermissions()
  if (!perms)
    return empty
  return {
    Apps: { ...empty.Apps, ...perms.Apps, Allowed: perms.Apps?.Allowed ?? [] },
    Channels: { ...empty.Channels, ...perms.Channels, Allowed: perms.Channels?.Allowed ?? [] },
    Platforms: { ...empty.Platforms, ...perms.Platforms, Allowed: perms.Platforms?.Allowed ?? [] },
    Archs: { ...empty.Archs, ...perms.Archs, Allowed: perms.Archs?.Allowed ?? [] },
  }
}

interface Props {
  value: TeamUserPermissions
  onChange: (next: TeamUserPermissions) => void
  appNames: string[]
}

type Group = keyof TeamUserPermissions

export function PermissionMatrix({ value, onChange, appNames }: Props) {
  const { t } = useTranslation('settings')
  const channels = useChannelsQuery()
  const platforms = usePlatformsQuery()
  const archs = useArchitecturesQuery()

  const setGroup = (group: Group, patch: Partial<TeamUserPermissions[Group]>) => {
    onChange({
      ...value,
      [group]: { ...(value[group] as object), ...patch },
    } as TeamUserPermissions)
  }

  const toggleAllowed = (group: Group, name: string) => {
    const current = value[group].Allowed ?? []
    const allowed = current.includes(name)
      ? current.filter(x => x !== name)
      : [...current, name]
    setGroup(group, { Allowed: allowed })
  }

  const channelNames = channels.data?.map(c => c.ChannelName) ?? []
  const platformNames = platforms.data?.map(p => p.PlatformName) ?? []
  const archNames = archs.data?.map(a => a.ArchID) ?? []

  return (
    <div className="space-y-3">
      <PermissionGroupCard
        title={t('permissions.apps', { defaultValue: 'Applications' })}
        flags={[
          ['Create', t('permissions.flags.create', { defaultValue: 'Create' })],
          ['Edit', t('permissions.flags.edit', { defaultValue: 'Edit' })],
          ['Delete', t('permissions.flags.delete', { defaultValue: 'Delete' })],
          ['Upload', t('permissions.flags.upload', { defaultValue: 'Upload' })],
          ['Download', t('permissions.flags.download', { defaultValue: 'Download' })],
        ]}
        flagValues={value.Apps as unknown as Record<string, boolean>}
        onFlag={(flag, v) => setGroup('Apps', { [flag]: v } as Partial<TeamUserPermissions['Apps']>)}
        allowedTitle={t('permissions.allowed_apps', { defaultValue: 'Allowed apps (empty = all)' })}
        allowedItems={appNames}
        allowedSelected={value.Apps.Allowed}
        onToggleAllowed={n => toggleAllowed('Apps', n)}
      />
      <PermissionGroupCard
        title={t('permissions.channels', { defaultValue: 'Channels' })}
        flags={[
          ['Create', t('permissions.flags.create')],
          ['Edit', t('permissions.flags.edit')],
          ['Delete', t('permissions.flags.delete')],
        ]}
        flagValues={value.Channels as unknown as Record<string, boolean>}
        onFlag={(flag, v) => setGroup('Channels', { [flag]: v })}
        allowedTitle={t('permissions.allowed_channels', { defaultValue: 'Allowed channels (empty = all)' })}
        allowedItems={channelNames}
        allowedSelected={value.Channels.Allowed}
        onToggleAllowed={n => toggleAllowed('Channels', n)}
      />
      <PermissionGroupCard
        title={t('permissions.platforms', { defaultValue: 'Platforms' })}
        flags={[
          ['Create', t('permissions.flags.create')],
          ['Edit', t('permissions.flags.edit')],
          ['Delete', t('permissions.flags.delete')],
        ]}
        flagValues={value.Platforms as unknown as Record<string, boolean>}
        onFlag={(flag, v) => setGroup('Platforms', { [flag]: v })}
        allowedTitle={t('permissions.allowed_platforms', { defaultValue: 'Allowed platforms (empty = all)' })}
        allowedItems={platformNames}
        allowedSelected={value.Platforms.Allowed}
        onToggleAllowed={n => toggleAllowed('Platforms', n)}
      />
      <PermissionGroupCard
        title={t('permissions.archs', { defaultValue: 'Architectures' })}
        flags={[
          ['Create', t('permissions.flags.create')],
          ['Edit', t('permissions.flags.edit')],
          ['Delete', t('permissions.flags.delete')],
        ]}
        flagValues={value.Archs as unknown as Record<string, boolean>}
        onFlag={(flag, v) => setGroup('Archs', { [flag]: v })}
        allowedTitle={t('permissions.allowed_archs', { defaultValue: 'Allowed architectures (empty = all)' })}
        allowedItems={archNames}
        allowedSelected={value.Archs.Allowed}
        onToggleAllowed={n => toggleAllowed('Archs', n)}
      />
    </div>
  )
}

interface GroupCardProps {
  title: string
  flags: [string, string][]
  flagValues: Record<string, boolean>
  onFlag: (flag: string, value: boolean) => void
  allowedTitle: string
  allowedItems: string[]
  allowedSelected: string[]
  onToggleAllowed: (name: string) => void
}

function PermissionGroupCard({
  title,
  flags,
  flagValues,
  onFlag,
  allowedTitle,
  allowedItems,
  allowedSelected,
  onToggleAllowed,
}: GroupCardProps) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-3">
        {flags.map(([flag, label]) => (
          <label key={flag} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(flagValues[flag])}
              onCheckedChange={(v: boolean | 'indeterminate') => onFlag(flag, v === true)}
            />
            {label}
          </label>
        ))}
      </div>
      {allowedItems.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {allowedTitle}
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {allowedItems.map(name => (
              <label key={name} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={(allowedSelected ?? []).includes(name)}
                  onCheckedChange={() => onToggleAllowed(name)}
                />
                <span className="truncate">{name}</span>
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

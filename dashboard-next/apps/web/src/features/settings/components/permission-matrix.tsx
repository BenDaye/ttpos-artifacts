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

// Backend nil slices are serialized as null; normalize them before rendering.
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
  appItems: PermissionResourceItem[]
}

type Group = keyof TeamUserPermissions

export interface PermissionResourceItem {
  value: string
  label: string
}

export function makePermissionItems<T>(
  items: T[] | undefined,
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
): PermissionResourceItem[] {
  return (items ?? []).map(item => ({
    value: getValue(item),
    label: getLabel(item),
  }))
}

export function coerceAllowedValuesToIds(
  allowed: string[],
  items: PermissionResourceItem[],
): string[] {
  const idByLabel = new Map(items.map(item => [item.label, item.value]))
  return allowed.map(value => idByLabel.get(value) ?? value)
}

export function PermissionMatrix({ value, onChange, appItems }: Props) {
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

  const toggleAllowed = (group: Group, item: PermissionResourceItem) => {
    const current = value[group].Allowed ?? []
    const selected = current.includes(item.value) || current.includes(item.label)
    const allowed = selected
      ? current.filter(x => x !== item.value && x !== item.label)
      : [...current, item.value]
    setGroup(group, { Allowed: allowed })
  }

  const channelItems = makePermissionItems(channels.data, c => c.ID, c => c.ChannelName)
  const platformItems = makePermissionItems(platforms.data, p => p.ID, p => p.PlatformName)
  const archItems = makePermissionItems(archs.data, a => a.ID, a => a.ArchID)

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
        allowedItems={appItems}
        allowedSelected={value.Apps.Allowed}
        onToggleAllowed={item => toggleAllowed('Apps', item)}
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
        allowedItems={channelItems}
        allowedSelected={value.Channels.Allowed}
        onToggleAllowed={item => toggleAllowed('Channels', item)}
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
        allowedItems={platformItems}
        allowedSelected={value.Platforms.Allowed}
        onToggleAllowed={item => toggleAllowed('Platforms', item)}
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
        allowedItems={archItems}
        allowedSelected={value.Archs.Allowed}
        onToggleAllowed={item => toggleAllowed('Archs', item)}
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
  allowedItems: PermissionResourceItem[]
  allowedSelected: string[]
  onToggleAllowed: (item: PermissionResourceItem) => void
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
            {allowedItems.map(item => (
              <label key={item.value} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={(allowedSelected ?? []).includes(item.value) || (allowedSelected ?? []).includes(item.label)}
                  onCheckedChange={() => onToggleAllowed(item)}
                />
                <span className="truncate">{item.label}</span>
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

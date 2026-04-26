import { Filter, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { useChannelsQuery } from '@/features/channels/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'

export interface VersionFilters {
  channels: string[]
  platforms: string[]
  archs: string[]
  publishedOnly: boolean
  criticalOnly: boolean
}

export const EMPTY_VERSION_FILTERS: VersionFilters = {
  channels: [],
  platforms: [],
  archs: [],
  publishedOnly: false,
  criticalOnly: false,
}

interface Props {
  value: VersionFilters
  onChange: (next: VersionFilters) => void
}

export function VersionFilterBar({ value, onChange }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const channels = useChannelsQuery()
  const platforms = usePlatformsQuery()
  const archs = useArchitecturesQuery()

  const channelOptions = channels.data?.map(c => c.ChannelName) ?? []
  const platformOptions = platforms.data?.map(p => p.PlatformName) ?? []
  const archOptions = archs.data?.map(a => a.ArchID) ?? []

  const totalActive
    = value.channels.length
      + value.platforms.length
      + value.archs.length
      + (value.publishedOnly ? 1 : 0)
      + (value.criticalOnly ? 1 : 0)

  const reset = () => onChange(EMPTY_VERSION_FILTERS)

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <MultiSelectPopover
        label={t('filter.channels', { defaultValue: 'Channels' })}
        options={channelOptions}
        selected={value.channels}
        onChange={channels => onChange({ ...value, channels })}
      />
      <MultiSelectPopover
        label={t('filter.platforms', { defaultValue: 'Platforms' })}
        options={platformOptions}
        selected={value.platforms}
        onChange={platforms => onChange({ ...value, platforms })}
      />
      <MultiSelectPopover
        label={t('filter.archs', { defaultValue: 'Architectures' })}
        options={archOptions}
        selected={value.archs}
        onChange={archs => onChange({ ...value, archs })}
      />
      <ToggleChip
        label={t('filter.published_only', { defaultValue: 'Published only' })}
        active={value.publishedOnly}
        onClick={() => onChange({ ...value, publishedOnly: !value.publishedOnly })}
      />
      <ToggleChip
        label={t('filter.critical_only', { defaultValue: 'Critical only' })}
        active={value.criticalOnly}
        onClick={() => onChange({ ...value, criticalOnly: !value.criticalOnly })}
      />
      {totalActive > 0 && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="size-3.5" />
          {t('filter.clear', { defaultValue: 'Clear' })}
          {' '}
          (
          {totalActive}
          )
        </Button>
      )}
    </div>
  )
}

interface MultiProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

function MultiSelectPopover({ label, options, selected, onChange }: MultiProps) {
  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter(x => x !== name) : [...selected, name])
  }
  return (
    <Popover>
      <PopoverTrigger
        render={(
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Filter className="size-3.5" />
            {label}
            {selected.length > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{selected.length}</Badge>
            )}
          </Button>
        )}
      />
      <PopoverContent align="start" className="w-56 p-2">
        {options.length === 0
          ? <p className="px-2 py-3 text-xs text-muted-foreground">—</p>
          : (
              <div className="max-h-60 overflow-auto">
                {options.map(o => (
                  <label key={o} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                    <Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} />
                    <span className="truncate">{o}</span>
                  </label>
                ))}
              </div>
            )}
      </PopoverContent>
    </Popover>
  )
}

function ToggleChip({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-8"
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </Button>
  )
}

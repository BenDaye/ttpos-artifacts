import { Badge } from '@ttpos/ui/components/badge'
import { Button } from '@ttpos/ui/components/button'
import { Checkbox } from '@ttpos/ui/components/checkbox'
import { Input } from '@ttpos/ui/components/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@ttpos/ui/components/popover'
import { Filter, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { useChannelsQuery } from '@/features/channels/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'

export interface VersionFilters {
  channels: string[]
  platforms: string[]
  archs: string[]
  publishedOnly: boolean
  criticalOnly: boolean
  search: string
}

export const EMPTY_VERSION_FILTERS: VersionFilters = {
  channels: [],
  platforms: [],
  archs: [],
  publishedOnly: false,
  criticalOnly: false,
  search: '',
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
      + (value.search ? 1 : 0)

  const reset = () => onChange(EMPTY_VERSION_FILTERS)

  return (
    <div className="mb-4 grid max-w-full min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 w-full sm:w-60 sm:flex-none" data-testid="version-filter-search">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={e => onChange({ ...value, search: e.target.value })}
          placeholder={t('filter.search_placeholder', { defaultValue: 'Search version…' })}
          className="h-8 pl-8 text-sm"
        />
      </div>
      <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:contents" data-testid="version-filter-controls">
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
          <Button variant="ghost" size="sm" className="shrink-0" onClick={reset}>
            <X className="size-3.5" />
            {t('filter.clear', { defaultValue: 'Clear' })}
            {' '}
            (
            {totalActive}
            )
          </Button>
        )}
      </div>
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
          <Button variant="outline" size="sm" className="h-8 max-w-full shrink-0 gap-1.5">
            <Filter className="size-3.5" />
            <span className="min-w-0 truncate">{label}</span>
            {selected.length > 0 && (
              <Badge variant="secondary" className="px-2 py-0 text-xs">{selected.length}</Badge>
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
                  <label key={o} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
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
      className="h-8 shrink-0"
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </Button>
  )
}

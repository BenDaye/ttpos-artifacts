import type { TelemetryRange } from '../api'
import { Filter, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppsListQuery } from '@/features/apps/hooks'
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
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

export interface TelemetryFilters {
  apps: string[]
  channels: string[]
  platforms: string[]
  architectures: string[]
  range: TelemetryRange
}

export const EMPTY_TELEMETRY_FILTERS: TelemetryFilters = {
  apps: [],
  channels: [],
  platforms: [],
  architectures: [],
  range: 'week',
}

const RANGES: TelemetryRange[] = ['today', 'week', 'month']

interface Props {
  value: TelemetryFilters
  onChange: (next: TelemetryFilters) => void
}

export function TelemetryFilterBar({ value, onChange }: Props) {
  const { t } = useTranslation(['telemetry', 'common'])
  const apps = useAppsListQuery({ page: 1, limit: 200 })
  const channels = useChannelsQuery()
  const platforms = usePlatformsQuery()
  const archs = useArchitecturesQuery()

  const totalActive
    = value.apps.length
      + value.channels.length
      + value.platforms.length
      + value.architectures.length

  const reset = () => onChange({ ...EMPTY_TELEMETRY_FILTERS, range: value.range })

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <ToggleGroup>
        {RANGES.map(r => (
          <ToggleGroupItem
            key={r}
            value={r}
            aria-pressed={r === value.range}
            data-pressed={r === value.range}
            onClick={() => onChange({ ...value, range: r })}
          >
            {t(`range.${r}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />
      <MultiSelectPopover
        label={t('filter.apps', { defaultValue: 'Apps' })}
        options={apps.data?.apps.map(a => a.AppName) ?? []}
        selected={value.apps}
        onChange={next => onChange({ ...value, apps: next })}
      />
      <MultiSelectPopover
        label={t('filter.channels', { defaultValue: 'Channels' })}
        options={channels.data?.map(c => c.ChannelName) ?? []}
        selected={value.channels}
        onChange={next => onChange({ ...value, channels: next })}
      />
      <MultiSelectPopover
        label={t('filter.platforms', { defaultValue: 'Platforms' })}
        options={platforms.data?.map(p => p.PlatformName) ?? []}
        selected={value.platforms}
        onChange={next => onChange({ ...value, platforms: next })}
      />
      <MultiSelectPopover
        label={t('filter.architectures', { defaultValue: 'Architectures' })}
        options={archs.data?.map(a => a.ArchID) ?? []}
        selected={value.architectures}
        onChange={next => onChange({ ...value, architectures: next })}
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
              <Badge variant="secondary" className="px-2 py-0 text-micro">{selected.length}</Badge>
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

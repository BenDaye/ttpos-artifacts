import type { TelemetryRange } from '../api'
import { FunnelIcon, XIcon } from '@phosphor-icons/react'
import { Badge } from '@ttpos/ui/components/badge'
import { Button } from '@ttpos/ui/components/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@ttpos/ui/components/combobox'
import { ToggleGroup, ToggleGroupItem } from '@ttpos/ui/components/toggle-group'
import { useTranslation } from 'react-i18next'
import { useAppsListQuery } from '@/features/apps/hooks'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { useChannelsQuery } from '@/features/channels/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'

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
const RANGE_LABELS: Record<TelemetryRange, string> = {
  today: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
}

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
    <div className="mb-4 grid max-w-full min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:contents" data-testid="telemetry-filter-controls">
        <ToggleGroup className="shrink-0 flex-nowrap" data-testid="telemetry-range-group">
          {RANGES.map(r => (
            <ToggleGroupItem
              key={r}
              value={r}
              pressed={r === value.range}
              data-pressed={r === value.range}
              onClick={() => onChange({ ...value, range: r })}
            >
              {t(`range.${r}`, { defaultValue: RANGE_LABELS[r] })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="mx-1 hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />
        <MultiSelectFilter
          label={t('filter.apps', { defaultValue: 'Apps' })}
          options={apps.data?.apps.map(a => a.AppName) ?? []}
          selected={value.apps}
          onChange={next => onChange({ ...value, apps: next })}
        />
        <MultiSelectFilter
          label={t('filter.channels', { defaultValue: 'Channels' })}
          options={channels.data?.map(c => c.ChannelName) ?? []}
          selected={value.channels}
          onChange={next => onChange({ ...value, channels: next })}
        />
        <MultiSelectFilter
          label={t('filter.platforms', { defaultValue: 'Platforms' })}
          options={platforms.data?.map(p => p.PlatformName) ?? []}
          selected={value.platforms}
          onChange={next => onChange({ ...value, platforms: next })}
        />
        <MultiSelectFilter
          label={t('filter.architectures', { defaultValue: 'Architectures' })}
          options={archs.data?.map(a => a.ArchID) ?? []}
          selected={value.architectures}
          onChange={next => onChange({ ...value, architectures: next })}
        />
        {totalActive > 0 && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={reset}>
            <XIcon className="size-3.5" />
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

function MultiSelectFilter({ label, options, selected, onChange }: MultiProps) {
  const { t } = useTranslation('common')
  return (
    <Combobox items={options} multiple value={selected} onValueChange={onChange}>
      <ComboboxTrigger
        render={(
          <Button variant="outline" size="sm" aria-label={label} className="h-8 max-w-full shrink-0 gap-1.5">
            <FunnelIcon className="size-3.5" />
            <span className="min-w-0 truncate">{label}</span>
            {selected.length > 0 && (
              <Badge variant="secondary" className="px-2 py-0 text-xs">{selected.length}</Badge>
            )}
          </Button>
        )}
      />
      <ComboboxContent className="w-56">
        <ComboboxInput
          showTrigger={false}
          placeholder={t('actions.search', { defaultValue: 'Search…' })}
        />
        <ComboboxEmpty>{t('states.no_results', { defaultValue: 'No results' })}</ComboboxEmpty>
        <ComboboxList>
          {(option: string) => (
            <ComboboxItem key={option} value={option}>
              <span className="truncate">{option}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

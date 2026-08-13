import { FunnelIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
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
import { Input } from '@ttpos/ui/components/input'
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
        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={e => onChange({ ...value, search: e.target.value })}
          placeholder={t('filter.search_placeholder', { defaultValue: 'Search version…' })}
          className="pl-8"
        />
      </div>
      <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:contents" data-testid="version-filter-controls">
        <MultiSelectFilter
          label={t('filter.channels', { defaultValue: 'Channels' })}
          options={channelOptions}
          selected={value.channels}
          onChange={channels => onChange({ ...value, channels })}
        />
        <MultiSelectFilter
          label={t('filter.platforms', { defaultValue: 'Platforms' })}
          options={platformOptions}
          selected={value.platforms}
          onChange={platforms => onChange({ ...value, platforms })}
        />
        <MultiSelectFilter
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
          <Button variant="ghost" className="shrink-0" onClick={reset}>
            <XIcon />
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
          <Button variant="outline" aria-label={label} className="max-w-full shrink-0">
            <FunnelIcon />
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

function ToggleChip({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      className="shrink-0"
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </Button>
  )
}

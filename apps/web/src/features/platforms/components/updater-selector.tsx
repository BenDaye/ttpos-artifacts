import type { Updater, UpdaterType } from '@ttpos/shared'
import { Apple, Laptop, MonitorCog, PackageCheck, Radio, Sparkles, Star, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { cn } from '@/shared/lib/utils'
import { getDefaultUpdaterType, normalizeUpdaters, UPDATER_OPTIONS } from '../updaters'

interface Props {
  value: Updater[]
  onChange: (updaters: Updater[]) => void
}

const ICONS: Record<string, typeof Wrench> = {
  'manual': Wrench,
  'squirrel_darwin': Apple,
  'squirrel_windows': MonitorCog,
  'sparkle': Sparkles,
  'electron-builder': PackageCheck,
  'tauri': Laptop,
}

export function UpdaterSelector({ value, onChange }: Props) {
  const { t } = useTranslation('platforms')
  const updaters = normalizeUpdaters(value)
  const selected = new Set(updaters.map(updater => updater.type))
  const defaultType = getDefaultUpdaterType(updaters)

  const toggle = (type: UpdaterType, checked: boolean) => {
    if (type === 'manual' && !checked) {
      return
    }
    const next = checked
      ? [...updaters, { type, default: false }]
      : updaters.filter(updater => updater.type !== type)
    onChange(normalizeUpdaters(next))
  }

  const setDefault = (type: UpdaterType) => {
    onChange(normalizeUpdaters(updaters.map(updater => ({
      ...updater,
      default: updater.type === type,
    }))))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('form.updaters', { defaultValue: 'Updaters' })}</p>
          <p className="text-xs text-muted-foreground">{t('updaters.subtitle', { defaultValue: 'Select supported updater protocols for this platform.' })}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {t('form.default_updater', { defaultValue: 'Default' })}
          :
          {' '}
          {defaultType}
        </Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {UPDATER_OPTIONS.map((option) => {
          const Icon = ICONS[option.type] ?? Radio
          const isSelected = selected.has(option.type)
          const isDefault = defaultType === option.type
          const label = t(`updaters.options.${option.type}.label`, { defaultValue: option.label })
          const description = t(`updaters.options.${option.type}.description`, { defaultValue: option.description })
          return (
            <div
              key={option.type}
              className={cn(
                'rounded-md border border-border p-3 transition-colors',
                isSelected ? 'bg-muted/40' : 'bg-background',
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  disabled={option.type === 'manual'}
                  onCheckedChange={(checked: boolean | 'indeterminate') => toggle(option.type, checked === true)}
                  aria-label={label}
                  className="mt-0.5"
                />
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{label}</p>
                    {isDefault && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="size-3" />
                        {t('form.default_updater', { defaultValue: 'Default' })}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                  {isSelected && !isDefault && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={() => setDefault(option.type)}
                    >
                      <Star className="size-3" />
                      {t('form.set_default', { defaultValue: 'Use as default updater' })}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

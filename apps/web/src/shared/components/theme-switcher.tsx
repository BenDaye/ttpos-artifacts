import type { ThemeMode } from '@ttpos/shared'
import { MonitorIcon, MoonIcon, SunIcon } from '@phosphor-icons/react'
import { Button } from '@ttpos/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ttpos/ui/components/dropdown-menu'
import { useTranslation } from 'react-i18next'
import { useTheme } from './theme-provider'

const ICON_MAP: Record<ThemeMode, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  auto: MonitorIcon,
}

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme()
  const { t } = useTranslation('common')
  const Icon = ICON_MAP[mode]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button variant="ghost" size="icon" aria-label={t('theme.label', { defaultValue: 'Theme' })}>
            <Icon className="size-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setMode('light')}>
          <SunIcon className="size-4" />
          {t('theme.light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode('dark')}>
          <MoonIcon className="size-4" />
          {t('theme.dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode('auto')}>
          <MonitorIcon className="size-4" />
          {t('theme.auto')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

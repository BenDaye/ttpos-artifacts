import type { ThemeMode } from '@ttpos/shared'
import { Button } from '@ttpos/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ttpos/ui/components/dropdown-menu'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from './theme-provider'

const ICON_MAP: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  auto: Monitor,
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
          <Sun className="size-4" />
          {t('theme.light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode('dark')}>
          <Moon className="size-4" />
          {t('theme.dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode('auto')}>
          <Monitor className="size-4" />
          {t('theme.auto')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

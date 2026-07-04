import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'

const LANGS = ['en', 'zh'] as const

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common')
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button variant="ghost" size="icon" aria-label={t('language.label')}>
            <Languages className="size-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        {LANGS.map(lng => (
          <DropdownMenuCheckboxItem
            key={lng}
            checked={current.startsWith(lng)}
            onClick={() => i18n.changeLanguage(lng)}
          >
            {t(`language.${lng}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

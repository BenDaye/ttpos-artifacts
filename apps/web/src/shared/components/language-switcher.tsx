import { TranslateIcon } from '@phosphor-icons/react'
import { Button } from '@ttpos/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@ttpos/ui/components/dropdown-menu'
import { useTranslation } from 'react-i18next'

const LANGS = ['en', 'zh'] as const

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common')
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button variant="ghost" size="icon" aria-label={t('language.label')}>
            <TranslateIcon />
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

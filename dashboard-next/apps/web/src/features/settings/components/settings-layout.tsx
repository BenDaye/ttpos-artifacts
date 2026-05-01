import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/shared/components/page-header'
import { cn } from '@/shared/lib/utils'

const TABS = [
  { to: '/settings', match: '/settings', labelKey: 'tabs.users' },
  { to: '/settings/tokens', match: '/settings/tokens', labelKey: 'tabs.tokens' },
] as const

export function SettingsLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('settings')
  const pathname = useRouterState({ select: s => s.location.pathname })

  return (
    <div className="min-w-0 max-w-full">
      <PageHeader
        title={t('title', { defaultValue: 'Settings' })}
        description={t('description', { defaultValue: 'Users, security, and access.' })}
      />
      <div className="mb-6 flex max-w-full items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active = tab.match === '/settings'
            ? pathname === '/settings'
            : pathname.startsWith(tab.match)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(tab.labelKey, { defaultValue: tab.labelKey.replace('tabs.', '') })}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}

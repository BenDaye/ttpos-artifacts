import type { ComponentType } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import {
  BarChart3,
  ChevronLeft,
  Cpu,
  GitBranch,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/auth-store'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/ui-store'
import { AppVersionBadge } from './app-version-badge'
import { LanguageSwitcher } from './language-switcher'
import { ThemeSwitcher } from './theme-switcher'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

interface NavItem {
  to: string
  labelKey: string
  icon: ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { to: '/applications', labelKey: 'nav.applications', icon: LayoutGrid },
  { to: '/channels', labelKey: 'nav.channels', icon: GitBranch },
  { to: '/platforms', labelKey: 'nav.platforms', icon: Layers },
  { to: '/architectures', labelKey: 'nav.architectures', icon: Cpu },
  { to: '/statistics', labelKey: 'nav.statistics', icon: BarChart3 },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common')
  const collapsed = useUiStore(s => s.sidebarCollapsed)
  const toggleSidebar = useUiStore(s => s.toggleSidebar)
  const clearAuth = useAuthStore(s => s.clear)
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!mobileNavOpen)
      return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileNavOpen])

  const handleLogout = () => {
    setMobileNavOpen(false)
    clearAuth()
    void router.navigate({ to: '/signin' })
  }

  return (
    <div className="flex min-h-svh min-w-0 bg-background text-foreground">
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-sidebar/60 transition-opacity duration-200 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        className={cn(
          'dashboard-sidebar fixed inset-y-0 left-0 z-50 flex h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:z-auto md:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'md:w-14' : 'md:w-60',
        )}
        aria-label="Primary"
      >
        <div
          className={cn(
            'flex h-14 items-center justify-between gap-2 px-3',
            collapsed && 'md:justify-center md:px-1',
          )}
        >
          <span className={cn('truncate text-sm font-semibold tracking-tight', collapsed && 'md:hidden')}>
            {t('app.name')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-8 md:inline-flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </Button>
        </div>
        <Separator />
        <nav className={cn('flex-1 overflow-y-auto p-2', collapsed && 'md:p-1')}>
          <ul className="space-y-1">
            {NAV.map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === '/' }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    collapsed && 'md:justify-center md:px-0',
                  )}
                  activeProps={{
                    className:
                      'bg-sidebar-accent text-sidebar-accent-foreground',
                  }}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className={cn('truncate', collapsed && 'md:hidden')}>{t(item.labelKey)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Separator />
        <div className={cn('p-2', collapsed && 'md:p-1')}>
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full justify-start gap-2', collapsed && 'md:justify-center md:px-0')}
            onClick={handleLogout}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
            <span className={cn(collapsed && 'md:hidden')}>{t('auth.logout', { defaultValue: 'Sign out' })}</span>
          </Button>
        </div>
        <AppVersionBadge collapsed={collapsed} />
      </aside>

      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Toggle navigation"
          >
            <Menu className="size-4" />
          </Button>
          <div className="min-w-0 flex-1" />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </header>
        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

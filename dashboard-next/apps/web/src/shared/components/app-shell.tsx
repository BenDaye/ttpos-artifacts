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
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/auth-store'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/shared/stores/ui-store'
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

  const handleLogout = () => {
    clearAuth()
    void router.navigate({ to: '/signin' })
  }

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside
        className={cn(
          'sticky top-0 flex h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
        aria-label="Primary"
      >
        <div className="flex h-14 items-center justify-between gap-2 px-3">
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">
              {t('app.name')}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
          </Button>
        </div>
        <Separator />
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {NAV.map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === '/' }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                  activeProps={{
                    className:
                      'bg-sidebar-accent text-sidebar-accent-foreground',
                  }}
                >
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            className={cn('w-full justify-start gap-2', collapsed && 'justify-center')}
            onClick={handleLogout}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
            {!collapsed && <span>{t('auth.logout', { defaultValue: 'Sign out' })}</span>}
          </Button>
        </div>
      </aside>

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleSidebar}
            aria-label="Toggle navigation"
          >
            <Menu className="size-4" />
          </Button>
          <div className="flex-1" />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

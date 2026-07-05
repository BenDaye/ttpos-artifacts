import type { ComponentType } from 'react'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@ttpos/ui/components/sidebar'
import { cn } from '@ttpos/ui/lib/utils'
import { BarChart3, Cpu, GitBranch, Layers, LayoutGrid, LogOut, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/auth-store'
import { useUiStore } from '@/shared/stores/ui-store'
import { AppVersionBadge } from './app-version-badge'
import { LanguageSwitcher } from './language-switcher'
import { ThemeSwitcher } from './theme-switcher'

interface NavItemDef {
  to: string
  labelKey: string
  icon: ComponentType<{ className?: string }>
}

const NAV: NavItemDef[] = [
  { to: '/applications', labelKey: 'nav.applications', icon: LayoutGrid },
  { to: '/channels', labelKey: 'nav.channels', icon: GitBranch },
  { to: '/platforms', labelKey: 'nav.platforms', icon: Layers },
  { to: '/architectures', labelKey: 'nav.architectures', icon: Cpu },
  { to: '/statistics', labelKey: 'nav.statistics', icon: BarChart3 },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore(s => s.sidebarCollapsed)
  const toggleSidebar = useUiStore(s => s.toggleSidebar)

  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => {
        // Bridge SidebarProvider controlled mode to ui-store memory state.
        // Call toggleSidebar only when the desired open state differs from current.
        if (open === collapsed)
          toggleSidebar()
      }}
    >
      <AppShellContent collapsed={collapsed}>{children}</AppShellContent>
    </SidebarProvider>
  )
}

function AppShellContent({
  children,
  collapsed,
}: {
  children: React.ReactNode
  collapsed: boolean
}) {
  const { t } = useTranslation('common')
  const { setOpenMobile } = useSidebar()
  const clearAuth = useAuthStore(s => s.clear)
  const router = useRouter()
  const pathname = useRouterState({ select: s => s.location.pathname })

  const handleLogout = () => {
    setOpenMobile(false)
    clearAuth()
    void router.navigate({ to: '/signin' })
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-10 items-center gap-1 px-1">
            <SidebarTrigger className="hidden md:flex" />
            <span className={cn(
              'truncate text-sm font-semibold tracking-tight',
              'group-data-[collapsible=icon]:hidden',
            )}
            >
              {t('app.name')}
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(item => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={
                        <Link
                          to={item.to}
                          onClick={() => setOpenMobile(false)}
                        /> as unknown as React.ReactElement<Record<string, unknown>>
                      }
                      isActive={pathname.startsWith(item.to)}
                      tooltip={t(item.labelKey)}
                    >
                      <item.icon />
                      <span>{t(item.labelKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                tooltip={t('auth.logout', { defaultValue: 'Sign out' })}
              >
                <LogOut />
                <span>{t('auth.logout', { defaultValue: 'Sign out' })}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <AppVersionBadge collapsed={collapsed} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="md:hidden" />
          <div className="min-w-0 flex-1" />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </header>
        <div className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </>
  )
}

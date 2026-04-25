import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/features/auth/auth-store'
import { AppShell } from '@/shared/components/app-shell'

export const Route = createFileRoute('/_private')({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({
        to: '/signin',
        search: { redirect: location.href },
      })
    }
  },
  component: PrivateLayout,
})

function PrivateLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

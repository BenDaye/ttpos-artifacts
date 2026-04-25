import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/features/auth/auth-store'

export const Route = createFileRoute('/_public')({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/applications' })
    }
  },
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Outlet />
    </div>
  )
}

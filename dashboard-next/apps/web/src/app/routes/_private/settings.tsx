import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SettingsLayout } from '@/features/settings/components/settings-layout'

export const Route = createFileRoute('/_private/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  return (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  )
}

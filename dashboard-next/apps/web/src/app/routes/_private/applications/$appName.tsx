import { createFileRoute } from '@tanstack/react-router'
import { AppDetailPage } from '@/features/apps/components/app-detail-page'

export const Route = createFileRoute('/_private/applications/$appName')({
  component: AppDetailRoute,
})

function AppDetailRoute() {
  const { appName } = Route.useParams()
  return <AppDetailPage appName={appName} />
}

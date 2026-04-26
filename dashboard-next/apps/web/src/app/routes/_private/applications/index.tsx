import { createFileRoute } from '@tanstack/react-router'
import { ApplicationsPage } from '@/features/apps/components/applications-page'

export const Route = createFileRoute('/_private/applications/')({
  component: ApplicationsPage,
})

import { createFileRoute } from '@tanstack/react-router'
import { StatisticsPage } from '@/features/telemetry/components/statistics-page'

export const Route = createFileRoute('/_private/statistics')({
  component: StatisticsPage,
})

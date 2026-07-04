import { createFileRoute } from '@tanstack/react-router'
import { PlatformsPage } from '@/features/platforms/components/platforms-page'

export const Route = createFileRoute('/_private/platforms')({
  component: PlatformsPage,
})

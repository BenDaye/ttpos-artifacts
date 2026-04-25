import { createFileRoute } from '@tanstack/react-router'
import { ArchitecturesPage } from '@/features/architectures/components/architectures-page'

export const Route = createFileRoute('/_private/architectures')({
  component: ArchitecturesPage,
})

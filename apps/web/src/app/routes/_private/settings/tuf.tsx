import { createFileRoute } from '@tanstack/react-router'
import { TufPanel } from '@/features/settings/components/tuf-panel'

export const Route = createFileRoute('/_private/settings/tuf')({
  component: TufPanel,
})

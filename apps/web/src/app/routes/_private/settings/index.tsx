import { createFileRoute } from '@tanstack/react-router'
import { UsersPanel } from '@/features/settings/components/users-panel'

export const Route = createFileRoute('/_private/settings/')({
  component: UsersPanel,
})

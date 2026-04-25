import { createFileRoute } from '@tanstack/react-router'
import { ChannelsPage } from '@/features/channels/components/channels-page'

export const Route = createFileRoute('/_private/channels')({
  component: ChannelsPage,
})

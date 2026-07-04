import { createFileRoute } from '@tanstack/react-router'
import { TokensPanel } from '@/features/settings/components/tokens-panel'

export const Route = createFileRoute('/_private/settings/tokens')({
  component: TokensPanel,
})

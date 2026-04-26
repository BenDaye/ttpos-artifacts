import type { AppSummary } from '@ttpos/shared'

export interface AppViewProps {
  apps: AppSummary[]
  onSelect: (app: AppSummary) => void
  onEdit: (app: AppSummary) => void
  onDelete: (app: AppSummary) => void
}

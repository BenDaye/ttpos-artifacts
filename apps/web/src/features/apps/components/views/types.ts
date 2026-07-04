import type { AppSummary } from '@ttpos/shared'

export interface AppViewProps {
  apps: AppSummary[]
  onSelect: (app: AppSummary) => void
  onEdit: (app: AppSummary) => void
  onDelete: (app: AppSummary) => void
  // 拖拽排序回调，list / card / board 三视图共用
  onReorder?: (ids: string[]) => void
  // 是否允许拖拽排序；搜索过滤激活时为 false
  canReorder?: boolean
}

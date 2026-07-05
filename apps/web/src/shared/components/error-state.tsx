import type { ReactNode } from 'react'
import { Button } from '@ttpos/ui/components/button'
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/shared/components/empty-state'

interface ErrorStateProps {
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  retryLabel?: ReactNode
  className?: string
}

/**
 * 统一的错误态：与 EmptyState 共用「图标 + 文案 + 操作」骨架，
 * 但固定告警图标(单蓝之外的语义警示色)并提供重试入口,
 * 使「加载失败」在视觉上明确区别于「暂无数据」的空态。
 */
export function ErrorState({ title, description, onRetry, retryLabel, className }: ErrorStateProps) {
  const { t } = useTranslation('common')
  return (
    <EmptyState
      icon={CircleAlert}
      iconClassName="text-destructive"
      title={title ?? t('states.error_title', { defaultValue: 'Failed to load' })}
      description={description ?? t('states.error_description', {
        defaultValue: 'Something went wrong while loading. Please try again.',
      })}
      action={onRetry
        ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {retryLabel ?? t('actions.retry', { defaultValue: 'Retry' })}
            </Button>
          )
        : undefined}
      className={className}
    />
  )
}

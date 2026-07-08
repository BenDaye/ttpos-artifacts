import type { ReactNode } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Button } from '@ttpos/ui/components/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@ttpos/ui/components/empty'
import { cn } from '@ttpos/ui/lib/utils'
import { useTranslation } from 'react-i18next'

interface ErrorStateProps {
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  retryLabel?: ReactNode
  className?: string
}

/**
 * 统一的错误态：与 EmptyState 共用 Empty 家族骨架，
 * 固定告警图标（语义警示色）并提供重试入口，
 * 使「加载失败」在视觉上明确区别于「暂无数据」的空态。
 */
export function ErrorState({ title, description, onRetry, retryLabel, className }: ErrorStateProps) {
  const { t } = useTranslation('common')
  return (
    <Empty className={cn('border border-dashed border-border p-6 sm:p-12', className)}>
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-full [&_svg]:size-6"
        >
          <WarningCircleIcon className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle className="text-base font-medium text-foreground">
          {title ?? t('states.error_title', { defaultValue: 'Failed to load' })}
        </EmptyTitle>
        <EmptyDescription>
          {description ?? t('states.error_description', {
            defaultValue: 'Something went wrong while loading. Please try again.',
          })}
        </EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent className="mt-1">
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel ?? t('actions.retry', { defaultValue: 'Retry' })}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

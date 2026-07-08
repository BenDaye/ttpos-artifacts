import { ShieldSlashIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/shared/components/empty-state'

export function TufPanel() {
  const { t } = useTranslation('settings')
  return (
    <EmptyState
      icon={ShieldSlashIcon}
      title={t('tuf.disabled_title', { defaultValue: 'TUF management is disabled' })}
      description={t('tuf.disabled_description', {
        defaultValue:
          'TUF wizard is not available in this dashboard. Use the legacy dashboard or run the Python tuf CLI directly.',
      })}
    />
  )
}

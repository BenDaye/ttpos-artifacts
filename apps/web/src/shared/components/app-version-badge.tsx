import { cn } from '@ttpos/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { buildInfo, formatBuildTooltip, formatVersionLabel } from '@/shared/lib/app-version'

/**
 * 侧边栏底部常驻的版本徽标。
 *
 * 刻意做成非交互元素（纯 div，无 role/link/button），避免干扰 e2e 中
 * 依赖 `getByRole('link'/'button', { name })` 的导航与登出断言。
 * 完整的 commit / 构建时间通过 `title` 在 hover 时呈现。
 */
export function AppVersionBadge({ collapsed }: { collapsed?: boolean }) {
  const { t } = useTranslation('common')
  const label = formatVersionLabel(buildInfo.version)

  return (
    <div
      className={cn(
        'select-none truncate px-3 pb-2 text-[11px] leading-tight text-sidebar-foreground/45',
        collapsed && 'md:px-0 md:text-center',
      )}
      title={formatBuildTooltip(buildInfo)}
      aria-label={t('version.aria', { defaultValue: 'Application version' })}
    >
      {label}
    </div>
  )
}

import type { ComponentPropsWithoutRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

/**
 * 带明文切换的密码输入框:复用 Input 的全部样式与 aria-invalid 行为,
 * 右侧附一个可聚焦的眼睛按钮,便于用户自检输入,减少设密码时的错误。
 */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<'input'>, 'type'>) {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-12', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible(prev => !prev)}
        aria-label={visible
          ? t('actions.hide_password', { defaultValue: 'Hide password' })
          : t('actions.show_password', { defaultValue: 'Show password' })}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

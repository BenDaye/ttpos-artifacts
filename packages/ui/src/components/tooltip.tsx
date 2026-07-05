import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip'
import { cn } from '@ttpos/ui/lib/utils'

export const TooltipProvider = BaseTooltip.Provider
export const Tooltip = BaseTooltip.Root
export const TooltipTrigger = BaseTooltip.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  side,
  align,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof BaseTooltip.Popup> & {
  children: ReactNode
  sideOffset?: number
  side?: ComponentPropsWithoutRef<typeof BaseTooltip.Positioner>['side']
  align?: ComponentPropsWithoutRef<typeof BaseTooltip.Positioner>['align']
}) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={sideOffset} side={side} align={align}>
        <BaseTooltip.Popup
          className={cn(
            'z-50 max-w-xs rounded-md border bg-popover px-sm py-xs text-xs text-popover-foreground shadow-none outline-hidden',
            'data-starting:opacity-0 data-starting:scale-95',
            'data-ending:opacity-0 data-ending:scale-95',
            'transition-all duration-100',
            className,
          )}
          {...props}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

/**
 * 便利封装:给任意可聚焦/可 hover 元素挂一个文字提示。
 * content 为空时直接透传 children,避免渲染空 tooltip。
 * 适合给被 truncate 截断的文本补全文提示。
 */
export function SimpleTooltip({
  content,
  children,
}: {
  content: ReactNode
  children: ReactElement
}) {
  if (content == null || content === '') {
    return children
  }
  return (
    <Tooltip>
      <TooltipTrigger render={children as ReactElement<Record<string, unknown>>} />
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  )
}

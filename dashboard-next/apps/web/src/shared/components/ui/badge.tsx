import type { VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithoutRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'border border-border text-foreground',
        success:
          'border-transparent bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        warning:
          'border-transparent bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface BadgeProps
  extends ComponentPropsWithoutRef<'span'>,
  VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { Button } from '@ttpos/ui/components/button'
import { cn } from '@ttpos/ui/lib/utils'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function ScriptOutput({ script, className }: { script: string, className?: string }) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    window.setTimeout(setCopied, 1500, false)
  }

  return (
    <div className={cn('relative rounded-md border border-border bg-muted/30', className)}>
      <Button
        variant="outline"
        size="sm"
        className="absolute right-3 top-3"
        onClick={() => void onCopy()}
      >
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        {copied ? t('actions.copied', { defaultValue: 'Copied' }) : t('actions.copy', { defaultValue: 'Copy' })}
      </Button>
      <pre className="max-h-96 overflow-auto p-4 pr-24 text-xs leading-relaxed font-mono">
        {script}
      </pre>
    </div>
  )
}

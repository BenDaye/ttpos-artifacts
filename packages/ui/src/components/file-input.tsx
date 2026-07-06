import { Button } from '@ttpos/ui/components/button'
import { cn } from '@ttpos/ui/lib/utils'
import { useId, useRef } from 'react'

interface FileInputProps {
  multiple?: boolean
  accept?: string
  files?: File[]
  onChange: (files: File[]) => void
  buttonLabel: string
  emptyLabel: string
  summary?: (files: File[]) => string
  className?: string
  disabled?: boolean
  id?: string
}

// Wraps a hidden <input type="file"> with our own button so the visible label
// follows the app's i18n / theme instead of the browser's locale-bound default
// ("Choose file" / "选择文件" / etc.).
export function FileInput({
  multiple,
  accept,
  files = [],
  onChange,
  buttonLabel,
  emptyLabel,
  summary,
  className,
  disabled,
  id,
}: FileInputProps) {
  const reactId = useId()
  const inputId = id ?? reactId
  const inputRef = useRef<HTMLInputElement>(null)

  const summaryText = files.length === 0
    ? emptyLabel
    : (summary ? summary(files) : (files[0]?.name ?? ''))

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-controls={inputId}
      >
        {buttonLabel}
      </Button>
      <span
        className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
        data-testid="file-input-summary"
      >
        {summaryText}
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const list = e.target.files
          onChange(list ? Array.from(list) : [])
        }}
      />
    </div>
  )
}

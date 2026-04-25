import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useCreateTokenMutation } from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTokenDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const create = useCreateTokenMutation()
  const [name, setName] = useState('')
  const [expires, setExpires] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setName('')
      setExpires('')
      setRevealed(null)
    }
  }, [open])

  const onSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('common:states.error'))
      return
    }
    try {
      const result = await create.mutateAsync({
        name: trimmed,
        expires_in_days: expires ? Number(expires) : undefined,
      })
      setRevealed(result.token)
      toast.success(t('tokens.created', { defaultValue: 'Token created' }))
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('tokens.create_title', { defaultValue: 'Create API token' })}
      description={t('tokens.create_description', {
        defaultValue: 'Tokens grant CI access. Store them securely — you will not see the value again.',
      })}
      submitLabel={revealed ? t('common:actions.close') : t('common:actions.create')}
      loading={create.isPending}
      onSubmit={revealed ? () => onOpenChange(false) : onSubmit}
    >
      {revealed
        ? (
            <div className="space-y-2">
              <Label>{t('tokens.value', { defaultValue: 'Token value' })}</Label>
              <div className="flex items-center gap-2">
                <Input value={revealed} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t('common:actions.copy', { defaultValue: 'Copy' })}
                  onClick={() => {
                    void navigator.clipboard.writeText(revealed)
                    toast.success(t('common:actions.copied', { defaultValue: 'Copied' }))
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('tokens.value_warning', {
                  defaultValue: 'Copy this value now. It will not be shown again.',
                })}
              </p>
            </div>
          )
        : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="token-name">{t('tokens.name', { defaultValue: 'Name' })}</Label>
                <Input
                  id="token-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="github-actions-build"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token-expires">{t('tokens.expires', { defaultValue: 'Expires in (days, optional)' })}</Label>
                <Input
                  id="token-expires"
                  type="number"
                  value={expires}
                  onChange={e => setExpires(e.target.value)}
                  placeholder="90"
                />
              </div>
            </div>
          )}
    </EntityFormDialog>
  )
}

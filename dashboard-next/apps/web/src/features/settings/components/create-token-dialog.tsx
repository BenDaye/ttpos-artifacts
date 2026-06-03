import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppsListQuery } from '@/features/apps/hooks'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useCreateTokenMutation } from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DAY_MS = 24 * 60 * 60 * 1000

function isoExpiresFromDays(days: number | null): string | undefined {
  if (!days || days <= 0) {
    return undefined
  }
  return new Date(Date.now() + days * DAY_MS).toISOString()
}

export function CreateTokenDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation(['settings', 'common'])
  const create = useCreateTokenMutation()
  const apps = useAppsListQuery({ page: 1, limit: 200 })
  const [name, setName] = useState('')
  const [expiresDays, setExpiresDays] = useState('')
  const [allowed, setAllowed] = useState<Set<string>>(new Set())
  const [revealed, setRevealed] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setName('')
      setExpiresDays('')
      setAllowed(new Set())
      setRevealed(null)
    }
  }, [open])

  const onSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('common:states.error'))
      return
    }
    if (allowed.size === 0) {
      toast.error(t('tokens.select_app_required', { defaultValue: 'Select at least one app' }))
      return
    }
    try {
      const result = await create.mutateAsync({
        name: trimmed,
        allowed_apps: Array.from(allowed),
        expires_at: isoExpiresFromDays(expiresDays ? Number(expiresDays) : null),
      })
      setRevealed(result.token)
      toast.success(t('tokens.created', { defaultValue: 'Token created' }))
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  const toggleApp = (id: string) => {
    setAllowed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
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
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token-expires">
                  {t('tokens.expires_in_days', { defaultValue: 'Expires in (days, optional)' })}
                </Label>
                <Input
                  id="token-expires"
                  type="number"
                  min={1}
                  value={expiresDays}
                  onChange={e => setExpiresDays(e.target.value)}
                  placeholder="90"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('tokens.scope_label', { defaultValue: 'Scope' })}</Label>
                <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-border p-2">
                  {apps.data?.apps.map(app => (
                    <label key={app.ID} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={allowed.has(app.ID)}
                        onCheckedChange={() => toggleApp(app.ID)}
                      />
                      {app.AppName}
                    </label>
                  ))}
                  {!apps.data?.apps.length && (
                    <p className="text-xs text-muted-foreground">
                      {t('tokens.no_apps', { defaultValue: 'No apps available.' })}
                    </p>
                  )}
                </div>
                {allowed.size === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('tokens.scope_required_hint', {
                      defaultValue: 'API tokens require at least one allowed app.',
                    })}
                  </p>
                )}
              </div>
            </div>
          )}
    </EntityFormDialog>
  )
}

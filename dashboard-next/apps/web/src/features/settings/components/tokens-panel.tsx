import { Key, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAppsListQuery } from '@/features/apps/hooks'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { ErrorState } from '@/shared/components/error-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatDateTime } from '@/shared/lib/format'
import { useRevokeTokenMutation, useTokensQuery } from '../hooks'
import { CreateTokenDialog } from './create-token-dialog'

export function TokensPanel() {
  const { t } = useTranslation(['settings', 'common'])
  const tokensQuery = useTokensQuery()
  const appsQuery = useAppsListQuery({ page: 1, limit: 200 })
  const revoke = useRevokeTokenMutation()
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const appNameById = new Map((appsQuery.data?.apps ?? []).map(app => [app.ID, app.AppName]))

  const onRevoke = async () => {
    if (!revoking)
      return
    try {
      await revoke.mutateAsync(revoking)
      toast.success(t('tokens.revoked', { defaultValue: 'Token revoked' }))
      setRevoking(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t('tokens.create', { defaultValue: 'Create token' })}
        </Button>
      </div>

      {tokensQuery.isPending && (
        <div className="grid gap-3">
          {['sk-1', 'sk-2', 'sk-3'].map(k => (
            <Skeleton key={k} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {tokensQuery.isError && (
        <ErrorState onRetry={() => tokensQuery.refetch()} />
      )}

      {tokensQuery.isSuccess && tokensQuery.data.length === 0 && (
        <EmptyState
          icon={Key}
          title={t('tokens.empty', { defaultValue: 'No API tokens' })}
          description={t('tokens.empty_description', { defaultValue: 'Create one for CI uploads.' })}
          action={(
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('tokens.create', { defaultValue: 'Create token' })}
            </Button>
          )}
        />
      )}

      {tokensQuery.isSuccess && tokensQuery.data.length > 0 && (
        <div className="grid gap-3">
          {tokensQuery.data.map((token) => {
            const expiresAt = token.expires_at ? new Date(token.expires_at) : null
            const expired = expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt < new Date()
            return (
              <Card key={token.id}>
                <CardContent className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <Key className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{token.name}</p>
                        {expired && <Badge variant="destructive">{t('tokens.expired', { defaultValue: 'Expired' })}</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {token.token_prefix && (
                          <Badge variant="outline">
                            {token.token_prefix}
                            …
                          </Badge>
                        )}
                        {token.allowed_apps?.length
                          ? (
                              <span className="min-w-0 break-words">
                                {t('tokens.scope', { defaultValue: 'Scope:' })}
                                {' '}
                                {token.allowed_apps.map(id => appNameById.get(id) ?? id).join(', ')}
                              </span>
                            )
                          : (
                              <span>{t('tokens.scope_all', { defaultValue: 'All apps' })}</span>
                            )}
                        {formatDateTime(token.created_at) && (
                          <span>
                            {t('tokens.created_at', { defaultValue: 'Created' })}
                            {' '}
                            {formatDateTime(token.created_at)}
                          </span>
                        )}
                        {formatDateTime(token.expires_at) && (
                          <span>
                            {t('tokens.expires_at', { defaultValue: 'Expires' })}
                            {' '}
                            {formatDateTime(token.expires_at)}
                          </span>
                        )}
                        {formatDateTime(token.last_used_at) && (
                          <span>
                            {t('tokens.last_used', { defaultValue: 'Last used' })}
                            {' '}
                            {formatDateTime(token.last_used_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={t('tokens.revoke', { defaultValue: 'Revoke' })}
                    onClick={() => setRevoking(token.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CreateTokenDialog open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={open => !open && setRevoking(null)}
        title={t('tokens.revoke_title', { defaultValue: 'Revoke token?' })}
        description={t('tokens.revoke_description', {
          defaultValue: 'CI tools using this token will lose access immediately.',
        })}
        confirmLabel={t('tokens.revoke', { defaultValue: 'Revoke' })}
        destructive
        loading={revoke.isPending}
        onConfirm={onRevoke}
      />
    </div>
  )
}

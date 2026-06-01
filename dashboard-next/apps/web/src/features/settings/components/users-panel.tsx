import type { TeamUser } from '@ttpos/shared'
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, User } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { HttpError } from '@/shared/lib/http'
import { useDeleteUserMutation, useUsersListQuery, useWhoamiQuery } from '../hooks'
import { AdminCredentialDialog } from './admin-credential-dialog'
import { TeamUserFormDialog } from './team-user-form-dialog'

export function UsersPanel() {
  const { t } = useTranslation(['settings', 'common'])
  const usersQuery = useUsersListQuery()
  const me = useWhoamiQuery()
  const deleteMutation = useDeleteUserMutation()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TeamUser | null>(null)
  const [deleting, setDeleting] = useState<TeamUser | null>(null)
  const [adminEdit, setAdminEdit] = useState(false)

  const onDelete = async () => {
    if (!deleting)
      return
    try {
      await deleteMutation.mutateAsync(deleting.id)
      toast.success(t('users.deleted', { defaultValue: 'Team user deleted' }))
      setDeleting(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  const adminFallback = usersQuery.error instanceof HttpError && usersQuery.error.status === 403

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {me.data && (
        <Card>
          <CardContent className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <User className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{me.data.username}</p>
                <div className="mt-1 flex items-center gap-2">
                  {me.data.is_admin && <Badge variant="secondary">{t('users.admin_badge', { defaultValue: 'Admin' })}</Badge>}
                </div>
              </div>
            </div>
            {me.data.is_admin
              ? (
                  <Button variant="outline" size="sm" className="max-w-full" onClick={() => setAdminEdit(true)}>
                    <KeyRound className="size-4" />
                    <span className="min-w-0 truncate">{t('users.change_credentials', { defaultValue: 'Change credentials' })}</span>
                  </Button>
                )
              : (
                  <span className="text-xs text-muted-foreground">
                    {t('users.contact_admin', { defaultValue: 'Contact admin to change credentials' })}
                  </span>
                )}
          </CardContent>
        </Card>
      )}

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">{t('users.team_title', { defaultValue: 'Team users' })}</h2>
        <Button size="sm" onClick={() => setCreating(true)} disabled={!me.data?.is_admin}>
          <Plus className="size-4" />
          {t('users.create', { defaultValue: 'New user' })}
        </Button>
      </div>

      {usersQuery.isPending && (
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {usersQuery.isError && adminFallback && (
        <EmptyState
          icon={ShieldCheck}
          title={t('users.forbidden', { defaultValue: 'Admin only' })}
          description={t('users.forbidden_description', { defaultValue: 'Sign in as an admin to manage team users.' })}
        />
      )}
      {usersQuery.isError && !adminFallback && (
        <EmptyState
          title={t('common:states.error')}
          description={(usersQuery.error as Error)?.message}
        />
      )}

      {usersQuery.isSuccess && usersQuery.data.length === 0 && (
        <EmptyState
          icon={User}
          title={t('users.empty', { defaultValue: 'No team users yet' })}
          description={t('users.empty_description', { defaultValue: 'Invite teammates to grant scoped access.' })}
          action={(
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('users.create', { defaultValue: 'New user' })}
            </Button>
          )}
        />
      )}

      {usersQuery.isSuccess && usersQuery.data.length > 0 && (
        <div className="grid gap-3">
          {usersQuery.data.map(user => (
            <Card key={user.id}>
              <CardContent className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.username}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Badge variant="outline">{user.id.slice(0, 8)}</Badge>
                      <span>
                        {permissionSummary(user.permissions)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={t('common:actions.edit')} onClick={() => setEditing(user)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common:actions.delete')}
                    onClick={() => setDeleting(user)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TeamUserFormDialog open={creating} onOpenChange={setCreating} />
      <TeamUserFormDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditing(null)}
        user={editing}
      />
      <AdminCredentialDialog
        open={adminEdit}
        onOpenChange={setAdminEdit}
        user={me.data ?? null}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
        title={t('users.delete_title', { defaultValue: 'Delete team user?' })}
        description={t('users.delete_description', {
          name: deleting?.username ?? '',
          defaultValue: '{{name}} will lose access immediately.',
        })}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}

function permissionSummary(p: TeamUser['permissions']): string {
  const parts: string[] = []
  for (const [name, group] of Object.entries(p)) {
    const flags: string[] = []
    if (group.Create) {
      flags.push('C')
    }
    if (group.Edit) {
      flags.push('E')
    }
    if (group.Delete) {
      flags.push('D')
    }
    if ('Upload' in group && group.Upload) {
      flags.push('U')
    }
    if ('Download' in group && group.Download) {
      flags.push('R')
    }
    if (flags.length > 0) {
      parts.push(`${name}:${flags.join('')}`)
    }
  }
  return parts.length > 0 ? parts.join(' · ') : 'no rights'
}

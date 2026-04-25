import { Pencil, ShieldCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/shared/components/empty-state'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useUsersListQuery } from '../hooks'
import { UserCredentialDialog } from './user-credential-dialog'

export function UsersPanel() {
  const { t } = useTranslation(['settings', 'common'])
  const usersQuery = useUsersListQuery()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingUsername, setEditingUsername] = useState('')

  if (usersQuery.isPending) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  if (usersQuery.isError) {
    const message = (usersQuery.error as Error)?.message
    if (message?.toLowerCase().includes('forbidden') || message?.toLowerCase().includes('permission')) {
      return (
        <EmptyState
          icon={ShieldCheck}
          title={t('users.forbidden', { defaultValue: 'Admin only' })}
          description={t('users.forbidden_description', { defaultValue: 'Sign in as an admin to manage users.' })}
        />
      )
    }
    toast.error(message)
    return null
  }

  if (usersQuery.data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t('users.empty', { defaultValue: 'No users yet' })}
      />
    )
  }

  return (
    <div className="grid gap-3">
      {usersQuery.data.map(user => (
        <Card key={user.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar>
                <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.username}</p>
                <div className="mt-1 flex items-center gap-1">
                  {user.is_admin && <Badge variant="secondary">Admin</Badge>}
                  <Badge variant="outline">{user.id.slice(0, 8)}</Badge>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingId(user.id)
                setEditingUsername(user.username)
              }}
            >
              <Pencil className="size-4" />
              {t('common:actions.edit')}
            </Button>
          </CardContent>
        </Card>
      ))}
      <UserCredentialDialog
        open={Boolean(editingId)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingId(null)
            setEditingUsername('')
          }
        }}
        userId={editingId}
        username={editingUsername}
      />
    </div>
  )
}

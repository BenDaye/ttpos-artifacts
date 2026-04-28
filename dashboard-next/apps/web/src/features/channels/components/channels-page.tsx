import type { Channel } from '@ttpos/shared'
import { GitBranch, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useChannelsQuery, useDeleteChannelMutation } from '../hooks'
import { ChannelFormDialog } from './channel-form-dialog'

export function ChannelsPage() {
  const { t } = useTranslation(['channels', 'common'])
  const channelsQuery = useChannelsQuery()
  const deleteMutation = useDeleteChannelMutation()
  const [editing, setEditing] = useState<Channel | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Channel | null>(null)
  const [search, setSearch] = useState('')

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return channelsQuery.data ?? []
    }
    return (channelsQuery.data ?? []).filter(channel =>
      `${channel.ChannelName} ${channel.ID}`.toLowerCase().includes(q),
    )
  }, [channelsQuery.data, search])

  const onDelete = async () => {
    if (!deleting)
      return
    try {
      await deleteMutation.mutateAsync(deleting.ID)
      toast.success(t('deleted', { defaultValue: 'Channel deleted' }))
      setDeleting(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('common:nav.channels')}
        description={t('description', { defaultValue: 'Manage release channels for your applications.' })}
        actions={(
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t('common:actions.create')}
          </Button>
        )}
      />

      <div className="mb-4 flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common:actions.search')}
            className="pl-9"
          />
        </div>
      </div>

      {channelsQuery.isPending && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {channelsQuery.isError && (
        <EmptyState
          title={t('common:states.error')}
          description={(channelsQuery.error as Error)?.message}
        />
      )}

      {channelsQuery.isSuccess && filteredChannels.length === 0 && (
        <EmptyState
          icon={GitBranch}
          title={t('empty.title', { defaultValue: 'No channels yet' })}
          description={t('empty.description', { defaultValue: 'Create your first channel to start tagging releases.' })}
          action={(
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('common:actions.create')}
            </Button>
          )}
        />
      )}

      {channelsQuery.isSuccess && filteredChannels.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredChannels.map(channel => (
            <Card key={channel.ID}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <GitBranch className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{channel.ChannelName}</p>
                    <Badge variant="outline" className="mt-1">
                      {channel.ID.slice(0, 8)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common:actions.edit')}
                    onClick={() => setEditing(channel)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common:actions.delete')}
                    onClick={() => setDeleting(channel)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ChannelFormDialog open={creating} onOpenChange={setCreating} />
      <ChannelFormDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditing(null)}
        channel={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
        title={t('delete_title', { defaultValue: 'Delete channel?' })}
        description={t('delete_description', {
          defaultValue: 'Versions tied to this channel will lose their channel reference.',
        })}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}

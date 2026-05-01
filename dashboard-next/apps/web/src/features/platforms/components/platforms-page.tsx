import type { Platform } from '@ttpos/shared'
import { Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
import {
  useDeletePlatformMutation,
  usePlatformsQuery,
} from '../hooks'
import { PlatformFormDialog } from './platform-form-dialog'

export function PlatformsPage() {
  const { t } = useTranslation(['platforms', 'common'])
  const platformsQuery = usePlatformsQuery()
  const deleteMutation = useDeletePlatformMutation()
  const [editing, setEditing] = useState<Platform | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Platform | null>(null)
  const [search, setSearch] = useState('')

  const filteredPlatforms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return platformsQuery.data ?? []
    }
    return (platformsQuery.data ?? []).filter((platform) => {
      const updaterText = (platform.Updaters ?? []).map(updater => updater.type).join(' ')
      return `${platform.PlatformName} ${platform.ID} ${updaterText}`.toLowerCase().includes(q)
    })
  }, [platformsQuery.data, search])

  const onDelete = async () => {
    if (!deleting)
      return
    try {
      await deleteMutation.mutateAsync(deleting.ID)
      toast.success(t('deleted'))
      setDeleting(null)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  return (
    <div className="min-w-0 max-w-full">
      <PageHeader
        title={t('common:nav.platforms')}
        description={t('description')}
        actions={(
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t('common:actions.create')}
          </Button>
        )}
      />

      <div className="mb-4 flex w-full max-w-sm items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common:actions.search')}
            className="pl-9"
          />
        </div>
      </div>

      {platformsQuery.isPending && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {platformsQuery.isError && (
        <EmptyState
          title={t('common:states.error')}
          description={(platformsQuery.error as Error)?.message}
        />
      )}

      {platformsQuery.isSuccess && filteredPlatforms.length === 0 && (
        <EmptyState
          icon={Layers}
          title={t('empty.title')}
          description={t('empty.description')}
          action={(
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('common:actions.create')}
            </Button>
          )}
        />
      )}

      {platformsQuery.isSuccess && filteredPlatforms.length > 0 && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlatforms.map(platform => (
            <Card key={platform.ID}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Layers className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{platform.PlatformName}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">
                        {platform.ID.slice(0, 8)}
                      </Badge>
                      {(platform.Updaters ?? []).map(updater => (
                        <Badge key={updater.type} variant={updater.default ? 'secondary' : 'outline'}>
                          {updater.type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common:actions.edit')}
                    onClick={() => setEditing(platform)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common:actions.delete')}
                    onClick={() => setDeleting(platform)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlatformFormDialog open={creating} onOpenChange={setCreating} />
      <PlatformFormDialog
        open={Boolean(editing)}
        onOpenChange={open => !open && setEditing(null)}
        platform={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={open => !open && setDeleting(null)}
        title={t('delete_title')}
        description={t('delete_description')}
        confirmLabel={t('common:actions.delete')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}

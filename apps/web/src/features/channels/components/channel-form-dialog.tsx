import type { Channel } from '@ttpos/shared'
import { Input } from '@ttpos/ui/components/input'
import { Label } from '@ttpos/ui/components/label'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import {
  useCreateChannelMutation,
  useUpdateChannelMutation,
} from '../hooks'

interface ChannelFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel?: Channel | null
}

export function ChannelFormDialog({ open, onOpenChange, channel }: ChannelFormDialogProps) {
  const { t } = useTranslation(['channels', 'common'])
  const create = useCreateChannelMutation()
  const update = useUpdateChannelMutation()
  const editing = Boolean(channel)
  const mutation = editing ? update : create
  const [name, setName] = useState('')

  /* eslint-disable react/set-state-in-effect -- 打开/切换对象时重置表单字段,刻意的 prop-sync,非渲染期副作用误用 */
  useEffect(() => {
    setName(channel?.ChannelName ?? '')
  }, [channel, open])
  /* eslint-enable react/set-state-in-effect */

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('validation.required', { defaultValue: 'Required' }))
      return
    }
    try {
      if (editing && channel) {
        await update.mutateAsync({ id: channel.ID, channel: trimmed })
      }
      else {
        await create.mutateAsync(trimmed)
      }
      toast.success(t(editing ? 'updated' : 'created', { defaultValue: 'Saved' }))
      onOpenChange(false)
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
      title={editing ? t('edit_title', { defaultValue: 'Edit channel' }) : t('create_title', { defaultValue: 'Create channel' })}
      description={t('form.description', { defaultValue: 'Use a short, lowercase identifier (e.g. stable, beta).' })}
      loading={mutation.isPending}
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="channel-name">
          {t('form.name', { defaultValue: 'Channel name' })}
        </Label>
        <Input
          id="channel-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="stable"
          autoFocus
        />
      </div>
    </EntityFormDialog>
  )
}

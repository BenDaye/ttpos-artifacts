import type { Platform } from '@ttpos/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  useCreatePlatformMutation,
  useUpdatePlatformMutation,
} from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform?: Platform | null
}

export function PlatformFormDialog({ open, onOpenChange, platform }: Props) {
  const { t } = useTranslation(['platforms', 'common'])
  const create = useCreatePlatformMutation()
  const update = useUpdatePlatformMutation()
  const editing = Boolean(platform)
  const mutation = editing ? update : create
  const [name, setName] = useState('')

  useEffect(() => {
    setName(platform?.PlatformName ?? '')
  }, [platform, open])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('validation.required', { defaultValue: 'Required' }))
      return
    }
    try {
      if (editing && platform) {
        await update.mutateAsync({ id: platform.ID, platform: trimmed })
      }
      else {
        await create.mutateAsync({ platform: trimmed })
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
      title={editing ? t('edit_title') : t('create_title')}
      description={t('form.description')}
      loading={mutation.isPending}
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="platform-name">{t('form.name')}</Label>
        <Input
          id="platform-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="android"
          autoFocus
        />
      </div>
    </EntityFormDialog>
  )
}

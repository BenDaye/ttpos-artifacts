import type { Platform, Updater } from '@ttpos/shared'
import { Input } from '@ttpos/ui/components/input'
import { Label } from '@ttpos/ui/components/label'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import {
  useCreatePlatformMutation,
  useUpdatePlatformMutation,
} from '../hooks'
import { normalizeUpdaters } from '../updaters'
import { UpdaterSelector } from './updater-selector'

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
  const [updaters, setUpdaters] = useState<Updater[]>(() => normalizeUpdaters())

  /* eslint-disable react/set-state-in-effect -- 打开/切换对象时重置表单字段,刻意的 prop-sync,非渲染期副作用误用 */
  useEffect(() => {
    setName(platform?.PlatformName ?? '')
    setUpdaters(normalizeUpdaters(platform?.Updaters))
  }, [platform, open])
  /* eslint-enable react/set-state-in-effect */

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('validation.required', { defaultValue: 'Required' }))
      return
    }
    const normalizedUpdaters = normalizeUpdaters(updaters)
    try {
      if (editing && platform) {
        await update.mutateAsync({ id: platform.ID, platform: trimmed, updaters: normalizedUpdaters })
      }
      else {
        await create.mutateAsync({ platform: trimmed, updaters: normalizedUpdaters })
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
      <div className="space-y-4">
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
        <UpdaterSelector value={updaters} onChange={setUpdaters} />
      </div>
    </EntityFormDialog>
  )
}

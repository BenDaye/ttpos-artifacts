import type { Architecture } from '@ttpos/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  useCreateArchitectureMutation,
  useUpdateArchitectureMutation,
} from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  architecture?: Architecture | null
}

export function ArchitectureFormDialog({ open, onOpenChange, architecture }: Props) {
  const { t } = useTranslation(['architectures', 'common'])
  const create = useCreateArchitectureMutation()
  const update = useUpdateArchitectureMutation()
  const editing = Boolean(architecture)
  const mutation = editing ? update : create
  const [name, setName] = useState('')

  /* eslint-disable react/set-state-in-effect -- 打开/切换对象时重置表单字段,刻意的 prop-sync,非渲染期副作用误用 */
  useEffect(() => {
    setName(architecture?.ArchID ?? '')
  }, [architecture, open])
  /* eslint-enable react/set-state-in-effect */

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('validation.required', { defaultValue: 'Required' }))
      return
    }
    try {
      if (editing && architecture) {
        await update.mutateAsync({ id: architecture.ID, arch: trimmed })
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
      title={editing ? t('edit_title') : t('create_title')}
      description={t('form.description')}
      loading={mutation.isPending}
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="arch-name">{t('form.name')}</Label>
        <Input
          id="arch-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="amd64"
          autoFocus
        />
      </div>
    </EntityFormDialog>
  )
}

import type { AppSummary } from '@ttpos/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { FileInput } from '@/shared/components/ui/file-input'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { useCreateAppMutation, useUpdateAppMutation } from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  app?: AppSummary | null
}

export function AppFormDialog({ open, onOpenChange, app }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const create = useCreateAppMutation()
  const update = useUpdateAppMutation()
  const editing = Boolean(app)
  const mutation = editing ? update : create
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [enableTuf, setEnableTuf] = useState(false)

  useEffect(() => {
    if (open) {
      setName(app?.AppName ?? '')
      setDescription(app?.Description ?? '')
      setLogo(null)
      setIsPrivate(false)
      setEnableTuf(false)
    }
  }, [open, app])

  const onSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('common:states.error'))
      return
    }
    try {
      if (editing && app) {
        await update.mutateAsync({
          id: app.ID,
          app: trimmed,
          description: description.trim(),
          logo,
        })
      }
      else {
        await create.mutateAsync({
          app: trimmed,
          description: description.trim(),
          private: isPrivate,
          tuf: enableTuf,
          logo,
        })
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
      title={editing ? t('edit_title', { defaultValue: 'Edit application' }) : t('create_title', { defaultValue: 'Create application' })}
      description={t('form.description', {
        defaultValue: 'Use a short identifier; description and logo are optional.',
      })}
      loading={mutation.isPending}
      onSubmit={onSubmit}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="app-name">{t('form.name', { defaultValue: 'Name' })}</Label>
          <Input
            id="app-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="my-app"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-description">{t('form.description_label', { defaultValue: 'Description' })}</Label>
          <Textarea
            id="app-description"
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-logo">{t('form.logo', { defaultValue: 'Logo (optional)' })}</Label>
          <FileInput
            id="app-logo"
            accept="image/*"
            files={logo ? [logo] : []}
            onChange={(next) => {
              setLogo(next[0] ?? null)
            }}
            buttonLabel={t('common:file_input.choose_one', { defaultValue: 'Choose file' })}
            emptyLabel={t('common:file_input.empty', { defaultValue: 'No file chosen' })}
          />
        </div>
        {!editing && (
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isPrivate}
                onCheckedChange={(v: boolean | 'indeterminate') => setIsPrivate(v === true)}
              />
              {t('form.private', { defaultValue: 'Private (require auth to download)' })}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={enableTuf}
                onCheckedChange={(v: boolean | 'indeterminate') => setEnableTuf(v === true)}
              />
              {t('form.tuf', { defaultValue: 'Enable TUF metadata' })}
            </label>
          </div>
        )}
      </div>
    </EntityFormDialog>
  )
}

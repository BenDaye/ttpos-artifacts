import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { useChannelsQuery } from '@/features/channels/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'
import { getDefaultUpdaterType, getUpdaterLabel, normalizeUpdaters } from '@/features/platforms/updaters'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { FileInput } from '@/shared/components/ui/file-input'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { SelectField } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { useUploadVersionMutation } from '../hooks'

const schema = z.object({
  app_name: z.string().min(1),
  version: z.string().min(1),
  channel: z.string().min(1),
  platform: z.string().min(1),
  arch: z.string().min(1),
  publish: z.boolean(),
  critical: z.boolean(),
  intermediate: z.boolean(),
  changelog: z.string().optional(),
  updater: z.string().optional(),
  signature: z.string().optional(),
})

type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultAppName?: string
}

export function UploadVersionDialog({ open, onOpenChange, defaultAppName }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const upload = useUploadVersionMutation()
  const channels = useChannelsQuery()
  const platforms = usePlatformsQuery()
  const archs = useArchitecturesQuery()
  const [files, setFiles] = useState<File[]>([])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      app_name: defaultAppName ?? '',
      version: '',
      channel: '',
      platform: '',
      arch: '',
      publish: true,
      critical: false,
      intermediate: false,
      changelog: '',
      updater: 'manual',
      signature: '',
    },
  })

  const selectedPlatformName = form.watch('platform')
  const selectedUpdater = form.watch('updater')
  const selectedPlatform = platforms.data?.find(platform => platform.PlatformName === selectedPlatformName)
  const availableUpdaters = normalizeUpdaters(selectedPlatform?.Updaters)

  useEffect(() => {
    if (!selectedPlatformName) {
      form.setValue('updater', 'manual')
      form.setValue('signature', '')
      return
    }
    form.setValue('updater', getDefaultUpdaterType(selectedPlatform))
    form.setValue('signature', '')
  }, [form, selectedPlatform, selectedPlatformName])

  const handleSubmit = form.handleSubmit(async (values) => {
    if (files.length === 0) {
      toast.error(t('upload_dialog.no_file', { defaultValue: 'Please choose at least one file.' }))
      return
    }
    const updater = values.updater || getDefaultUpdaterType(selectedPlatform)
    if (updater === 'tauri' && !values.signature?.trim()) {
      toast.error(t('upload_dialog.signature_required', { defaultValue: 'Signature is required for Tauri artifacts.' }))
      return
    }
    try {
      await upload.mutateAsync({
        ...values,
        updater,
        signature: updater === 'tauri' ? values.signature?.trim() : undefined,
        files,
      })
      toast.success(t('upload_dialog.success', { defaultValue: 'Version uploaded' }))
      form.reset()
      setFiles([])
      onOpenChange(false)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  })

  const errors = form.formState.errors

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('upload_dialog.title', { defaultValue: 'Upload new version' })}
      description={t('upload_dialog.description', {
        defaultValue: 'Bundle artifacts under a single version entry.',
      })}
      submitLabel={t('common:actions.upload')}
      loading={upload.isPending}
      onSubmit={() => handleSubmit()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormBlock label={t('upload_dialog.app_name', { defaultValue: 'App name' })} error={errors.app_name?.message}>
          <Input placeholder="ttpos-pos" {...form.register('app_name')} />
        </FormBlock>
        <FormBlock label={t('upload_dialog.version', { defaultValue: 'Version' })} error={errors.version?.message}>
          <Input placeholder="1.2.3" {...form.register('version')} />
        </FormBlock>
        <FormBlock label={t('upload_dialog.channel', { defaultValue: 'Channel' })} error={errors.channel?.message}>
          <SelectField
            aria-label={t('upload_dialog.channel', { defaultValue: 'Channel' })}
            value={form.watch('channel')}
            onValueChange={next => form.setValue('channel', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
            options={(channels.data ?? []).map(c => ({ value: c.ChannelName, label: c.ChannelName }))}
          />
        </FormBlock>
        <FormBlock label={t('upload_dialog.platform', { defaultValue: 'Platform' })} error={errors.platform?.message}>
          <SelectField
            aria-label={t('upload_dialog.platform', { defaultValue: 'Platform' })}
            value={form.watch('platform')}
            onValueChange={next => form.setValue('platform', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
            options={(platforms.data ?? []).map(p => ({ value: p.PlatformName, label: p.PlatformName }))}
          />
        </FormBlock>
        <FormBlock label={t('upload_dialog.arch', { defaultValue: 'Architecture' })} error={errors.arch?.message}>
          <SelectField
            aria-label={t('upload_dialog.arch', { defaultValue: 'Architecture' })}
            value={form.watch('arch')}
            onValueChange={next => form.setValue('arch', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
            options={(archs.data ?? []).map(a => ({ value: a.ArchID, label: a.ArchID }))}
          />
        </FormBlock>
        {availableUpdaters.length > 1 && (
          <FormBlock label={t('upload_dialog.updater', { defaultValue: 'Updater' })}>
            <SelectField
              aria-label={t('upload_dialog.updater', { defaultValue: 'Updater' })}
              value={form.watch('updater') ?? 'manual'}
              onValueChange={(next) => {
                form.setValue('updater', next, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
                form.setValue('signature', '', { shouldDirty: true, shouldTouch: true, shouldValidate: true })
              }}
              options={availableUpdaters.map(updater => ({
                value: updater.type,
                label: `${getUpdaterLabel(updater.type)}${updater.default ? ` (${t('upload_dialog.default_updater', { defaultValue: 'default' })})` : ''}`,
              }))}
            />
          </FormBlock>
        )}
        {selectedUpdater === 'tauri' && (
          <FormBlock label={t('upload_dialog.signature', { defaultValue: 'Signature' })}>
            <Input placeholder="Tauri signature" {...form.register('signature')} />
          </FormBlock>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <FlagCheckbox
          label={t('upload_dialog.publish', { defaultValue: 'Publish' })}
          checked={form.watch('publish')}
          onChange={v => form.setValue('publish', v)}
        />
        <FlagCheckbox
          label={t('upload_dialog.critical', { defaultValue: 'Critical' })}
          checked={form.watch('critical')}
          onChange={v => form.setValue('critical', v)}
        />
        <FlagCheckbox
          label={t('upload_dialog.intermediate', { defaultValue: 'Intermediate' })}
          checked={form.watch('intermediate')}
          onChange={v => form.setValue('intermediate', v)}
        />
      </div>
      <div className="mt-3 space-y-2">
        <Label>{t('upload_dialog.changelog', { defaultValue: 'Changelog' })}</Label>
        <Textarea rows={4} placeholder="What's new in this build…" {...form.register('changelog')} />
      </div>
      <div className="mt-3 space-y-2">
        <Label>{t('upload_dialog.files', { defaultValue: 'Artifacts' })}</Label>
        <FileInput
          multiple
          files={files}
          onChange={setFiles}
          buttonLabel={t('common:file_input.choose_many', { defaultValue: 'Choose files' })}
          emptyLabel={t('common:file_input.empty', { defaultValue: 'No file chosen' })}
          summary={(selected) => {
            if (selected.length === 1)
              return selected[0]?.name ?? ''
            return `${selected.length} ${t('upload_dialog.file_count', { defaultValue: 'file(s) selected' })}`
          }}
        />
      </div>
    </EntityFormDialog>
  )
}

function FormBlock({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function FlagCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(value: boolean | 'indeterminate') => onChange(value === true)}
      />
      {label}
    </label>
  )
}

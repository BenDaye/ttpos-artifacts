import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { useChannelsQuery } from '@/features/channels/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
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
  changelog: z.string().optional(),
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
      changelog: '',
    },
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    if (files.length === 0) {
      toast.error(t('upload_dialog.no_file', { defaultValue: 'Please choose at least one file.' }))
      return
    }
    try {
      await upload.mutateAsync({
        ...values,
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

  const inputClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'

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
          <select className={inputClass} {...form.register('channel')}>
            <option value="">—</option>
            {channels.data?.map(c => (
              <option key={c.ID} value={c.ChannelName}>
                {c.ChannelName}
              </option>
            ))}
          </select>
        </FormBlock>
        <FormBlock label={t('upload_dialog.platform', { defaultValue: 'Platform' })} error={errors.platform?.message}>
          <select className={inputClass} {...form.register('platform')}>
            <option value="">—</option>
            {platforms.data?.map(p => (
              <option key={p.ID} value={p.PlatformName}>
                {p.PlatformName}
              </option>
            ))}
          </select>
        </FormBlock>
        <FormBlock label={t('upload_dialog.arch', { defaultValue: 'Architecture' })} error={errors.arch?.message}>
          <select className={inputClass} {...form.register('arch')}>
            <option value="">—</option>
            {archs.data?.map(a => (
              <option key={a.ID} value={a.ArchID}>
                {a.ArchID}
              </option>
            ))}
          </select>
        </FormBlock>
        <div className="flex items-center gap-4 self-end pb-2">
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
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Label>{t('upload_dialog.changelog', { defaultValue: 'Changelog' })}</Label>
        <Textarea rows={4} placeholder="What's new in this build…" {...form.register('changelog')} />
      </div>
      <div className="mt-3 space-y-2">
        <Label>{t('upload_dialog.files', { defaultValue: 'Artifacts' })}</Label>
        <input
          type="file"
          multiple
          onChange={(e) => {
            const list = e.target.files
            setFiles(list ? Array.from(list) : [])
          }}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
        />
        {files.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {files.length}
            {' '}
            {t('upload_dialog.file_count', { defaultValue: 'file(s) selected' })}
          </p>
        )}
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

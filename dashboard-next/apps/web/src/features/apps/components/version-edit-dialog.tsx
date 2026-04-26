import type { AppVersion } from '@ttpos/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { useChannelsQuery } from '@/features/channels/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { useUpdateVersionMutation } from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: AppVersion | null
}

export function VersionEditDialog({ open, onOpenChange, version }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const update = useUpdateVersionMutation()
  const channels = useChannelsQuery()
  const platforms = usePlatformsQuery()
  const archs = useArchitecturesQuery()

  const [versionStr, setVersionStr] = useState('')
  const [channel, setChannel] = useState('')
  const [platform, setPlatform] = useState('')
  const [arch, setArch] = useState('')
  const [publish, setPublish] = useState(true)
  const [critical, setCritical] = useState(false)
  const [changelog, setChangelog] = useState('')

  useEffect(() => {
    if (open && version) {
      setVersionStr(version.Version ?? '')
      setChannel(version.Channel ?? '')
      setPlatform(version.Platform ?? '')
      setArch(version.Arch ?? '')
      setPublish(Boolean(version.Published))
      setCritical(Boolean(version.Critical))
      setChangelog(version.Changelog ?? '')
    }
  }, [open, version])

  const onSubmit = async () => {
    if (!version) {
      return
    }
    try {
      await update.mutateAsync({
        id: version.ID,
        app_name: version.AppName,
        version: versionStr,
        channel,
        platform,
        arch,
        publish,
        critical,
        changelog,
      })
      toast.success(t('version_updated', { defaultValue: 'Version updated' }))
      onOpenChange(false)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : t('common:states.error')
      toast.error(message)
    }
  }

  const inputClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('edit_version_title', { defaultValue: 'Edit version' })}
      description={t('edit_version_description', {
        defaultValue: 'Update channel, platform, arch and metadata. Files cannot be replaced here.',
      })}
      loading={update.isPending}
      onSubmit={onSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('upload_dialog.version', { defaultValue: 'Version' })}>
          <Input value={versionStr} onChange={e => setVersionStr(e.target.value)} />
        </Field>
        <Field label={t('upload_dialog.channel', { defaultValue: 'Channel' })}>
          <select className={inputClass} value={channel} onChange={e => setChannel(e.target.value)}>
            {channels.data?.map(c => (
              <option key={c.ID} value={c.ChannelName}>
                {c.ChannelName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('upload_dialog.platform', { defaultValue: 'Platform' })}>
          <select className={inputClass} value={platform} onChange={e => setPlatform(e.target.value)}>
            {platforms.data?.map(p => (
              <option key={p.ID} value={p.PlatformName}>
                {p.PlatformName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('upload_dialog.arch', { defaultValue: 'Architecture' })}>
          <select className={inputClass} value={arch} onChange={e => setArch(e.target.value)}>
            {archs.data?.map(a => (
              <option key={a.ID} value={a.ArchID}>
                {a.ArchID}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-center gap-4 self-end pb-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={publish}
              onCheckedChange={(v: boolean | 'indeterminate') => setPublish(v === true)}
            />
            {t('upload_dialog.publish', { defaultValue: 'Publish' })}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={critical}
              onCheckedChange={(v: boolean | 'indeterminate') => setCritical(v === true)}
            />
            {t('upload_dialog.critical', { defaultValue: 'Critical' })}
          </label>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Label>{t('upload_dialog.changelog', { defaultValue: 'Changelog' })}</Label>
        <Textarea rows={4} value={changelog} onChange={e => setChangelog(e.target.value)} />
      </div>
    </EntityFormDialog>
  )
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

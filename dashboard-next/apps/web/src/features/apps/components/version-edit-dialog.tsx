import type { AppVersion, ChangelogEntry } from '@ttpos/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useChannelsQuery } from '@/features/channels/hooks'
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

function changelogToText(entries: ChangelogEntry[]): string {
  return entries
    .map(e => `## ${e.Version}${e.Date ? ` — ${e.Date}` : ''}\n${e.Changes}`)
    .join('\n\n')
}

export function VersionEditDialog({ open, onOpenChange, version }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const update = useUpdateVersionMutation()
  const channels = useChannelsQuery()

  const [versionStr, setVersionStr] = useState('')
  const [channel, setChannel] = useState('')
  const [publish, setPublish] = useState(true)
  const [critical, setCritical] = useState(false)
  const [changelogText, setChangelogText] = useState('')

  useEffect(() => {
    if (open && version) {
      setVersionStr(version.Version ?? '')
      setChannel(version.Channel ?? '')
      setPublish(Boolean(version.Published))
      setCritical(Boolean(version.Critical))
      setChangelogText(changelogToText(version.Changelog ?? []))
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
        publish,
        critical,
        changelog: changelogText,
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
        defaultValue: 'Update version metadata. To replace artifacts upload a new version.',
      })}
      loading={update.isPending}
      onSubmit={onSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('upload_dialog.version', { defaultValue: 'Version' })}</Label>
          <Input value={versionStr} onChange={e => setVersionStr(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('upload_dialog.channel', { defaultValue: 'Channel' })}</Label>
          <select className={inputClass} value={channel} onChange={e => setChannel(e.target.value)}>
            <option value="">—</option>
            {channels.data?.map(c => (
              <option key={c.ID} value={c.ChannelName}>
                {c.ChannelName}
              </option>
            ))}
          </select>
        </div>
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
        <Textarea rows={6} value={changelogText} onChange={e => setChangelogText(e.target.value)} />
      </div>
    </EntityFormDialog>
  )
}

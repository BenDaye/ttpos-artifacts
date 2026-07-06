import type { AppVersion, ChangelogEntry } from '@ttpos/shared'
import { Checkbox } from '@ttpos/ui/components/checkbox'
import { Input } from '@ttpos/ui/components/input'
import { Label } from '@ttpos/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ttpos/ui/components/select'
import { Textarea } from '@ttpos/ui/components/textarea'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useChannelsQuery } from '@/features/channels/hooks'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
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
  const [intermediate, setIntermediate] = useState(false)
  const [changelogText, setChangelogText] = useState('')

  // 记录已 seed 的版本 id：父级现传入「活」对象（按 id 从最新查询派生），
  // 同一版本的后台 refetch 会改变对象引用但 id 不变，此时不重新 seed，
  // 避免清空用户正在编辑的输入；仅在打开或切换到不同版本时 seed。
  const seededIdRef = useRef<string | null>(null)
  /* eslint-disable react/set-state-in-effect -- 按版本 id seed 表单字段,后台 refetch 不覆盖输入,刻意的 prop-sync,非渲染期副作用误用 */
  useEffect(() => {
    if (!open) {
      seededIdRef.current = null
      return
    }
    if (!version || seededIdRef.current === version.ID) {
      return
    }
    seededIdRef.current = version.ID
    setVersionStr(version.Version ?? '')
    setChannel(version.Channel ?? '')
    setPublish(Boolean(version.Published))
    setCritical(Boolean(version.Critical))
    setIntermediate(Boolean(version.Intermediate))
    setChangelogText(changelogToText(version.Changelog ?? []))
  }, [open, version])
  /* eslint-enable react/set-state-in-effect */

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
        intermediate,
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
          <Label className="flex items-center justify-between">
            <span>{t('upload_dialog.version', { defaultValue: 'Version' })}</span>
            <span className="text-xs text-muted-foreground">
              {t('edit_version_immutable_hint', { defaultValue: 'Read-only after creation' })}
            </span>
          </Label>
          <Input
            value={versionStr}
            onChange={e => setVersionStr(e.target.value)}
            disabled
            readOnly
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center justify-between">
            <span>{t('upload_dialog.channel', { defaultValue: 'Channel' })}</span>
            <span className="text-xs text-muted-foreground">
              {t('edit_version_immutable_hint', { defaultValue: 'Read-only after creation' })}
            </span>
          </Label>
          <Select value={channel} onValueChange={next => setChannel(next ?? '')} disabled>
            <SelectTrigger aria-label={t('upload_dialog.channel', { defaultValue: 'Channel' })}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(channels.data ?? []).map(c => (
                <SelectItem key={c.ChannelName} value={c.ChannelName}>{c.ChannelName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={intermediate}
              onCheckedChange={(v: boolean | 'indeterminate') => setIntermediate(v === true)}
            />
            {t('upload_dialog.intermediate', { defaultValue: 'Intermediate' })}
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

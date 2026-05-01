import type { AppVersion } from '@ttpos/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'
import { getDefaultUpdaterType, getUpdaterLabel, normalizeUpdaters } from '@/features/platforms/updaters'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { FileInput } from '@/shared/components/ui/file-input'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { SelectField } from '@/shared/components/ui/select'
import { useUpdateVersionMutation } from '../hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: AppVersion | null
}

export function AddArtifactDialog({ open, onOpenChange, version }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const update = useUpdateVersionMutation()
  const platforms = usePlatformsQuery()
  const archs = useArchitecturesQuery()

  const [platform, setPlatform] = useState('')
  const [arch, setArch] = useState('')
  const [updater, setUpdater] = useState('manual')
  const [signature, setSignature] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const selectedPlatform = platforms.data?.find(item => item.PlatformName === platform)
  const availableUpdaters = normalizeUpdaters(selectedPlatform?.Updaters)

  useEffect(() => {
    if (open) {
      setPlatform('')
      setArch('')
      setUpdater('manual')
      setSignature('')
      setFiles([])
    }
  }, [open])

  useEffect(() => {
    if (!platform) {
      setUpdater('manual')
      setSignature('')
      return
    }
    setUpdater(getDefaultUpdaterType(selectedPlatform))
    setSignature('')
  }, [platform, selectedPlatform])

  const onSubmit = async () => {
    if (!version) {
      return
    }
    if (!platform || !arch) {
      toast.error(t('add_artifact.validation_meta', { defaultValue: 'Please select platform and architecture' }))
      return
    }
    if (files.length === 0) {
      toast.error(t('upload_dialog.no_file', { defaultValue: 'Please choose at least one file.' }))
      return
    }
    if (updater === 'tauri' && !signature.trim()) {
      toast.error(t('upload_dialog.signature_required', { defaultValue: 'Signature is required for Tauri artifacts.' }))
      return
    }
    try {
      await update.mutateAsync({
        id: version.ID,
        app_name: version.AppName,
        version: version.Version,
        channel: version.Channel,
        publish: version.Published,
        critical: version.Critical,
        intermediate: version.Intermediate,
        platform,
        arch,
        updater,
        signature: updater === 'tauri' ? signature.trim() : undefined,
        files,
      })
      toast.success(t('add_artifact.success', { defaultValue: 'Artifact added' }))
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
      title={t('add_artifact.title', {
        version: version?.Version ?? '',
        defaultValue: 'Add artifact to {{version}}',
      })}
      description={t('add_artifact.description', {
        defaultValue: 'Upload a binary for a new platform / architecture combination on this version.',
      })}
      submitLabel={t('common:actions.upload')}
      loading={update.isPending}
      onSubmit={onSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('upload_dialog.platform', { defaultValue: 'Platform' })}</Label>
          <SelectField
            aria-label={t('upload_dialog.platform', { defaultValue: 'Platform' })}
            value={platform}
            onValueChange={setPlatform}
            options={(platforms.data ?? []).map(p => ({ value: p.PlatformName, label: p.PlatformName }))}
          />
        </div>
        {availableUpdaters.length > 1 && (
          <div className="space-y-2">
            <Label>{t('upload_dialog.updater', { defaultValue: 'Updater' })}</Label>
            <SelectField
              aria-label={t('upload_dialog.updater', { defaultValue: 'Updater' })}
              value={updater}
              onValueChange={(next) => {
                setUpdater(next)
                setSignature('')
              }}
              options={availableUpdaters.map(item => ({
                value: item.type,
                label: `${getUpdaterLabel(item.type)}${item.default ? ` (${t('upload_dialog.default_updater', { defaultValue: 'default' })})` : ''}`,
              }))}
            />
          </div>
        )}
        {updater === 'tauri' && (
          <div className="space-y-2">
            <Label>{t('upload_dialog.signature', { defaultValue: 'Signature' })}</Label>
            <Input
              value={signature}
              onChange={event => setSignature(event.target.value)}
              placeholder="Tauri signature"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label>{t('upload_dialog.arch', { defaultValue: 'Architecture' })}</Label>
          <SelectField
            aria-label={t('upload_dialog.arch', { defaultValue: 'Architecture' })}
            value={arch}
            onValueChange={setArch}
            options={(archs.data ?? []).map(a => ({ value: a.ArchID, label: a.ArchID }))}
          />
        </div>
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
      <p className="mt-3 text-xs text-muted-foreground">
        {t('add_artifact.context', {
          appName: version?.AppName ?? '',
          channel: version?.Channel ?? '',
          defaultValue: 'App: {{appName}} · Channel: {{channel}}',
        })}
      </p>
    </EntityFormDialog>
  )
}

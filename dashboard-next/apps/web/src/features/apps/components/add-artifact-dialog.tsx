import type { AppVersion } from '@ttpos/shared'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useArchitecturesQuery } from '@/features/architectures/hooks'
import { usePlatformsQuery } from '@/features/platforms/hooks'
import { getDefaultUpdaterType, getUpdaterLabel, normalizeUpdaters } from '@/features/platforms/updaters'
import { EntityFormDialog } from '@/shared/components/common/entity-form-dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
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

  const inputClass = 'flex h-11 w-full rounded-pill border border-input bg-transparent px-5 py-3 text-base shadow-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'
  const selectClass = `${inputClass} appearance-none pr-xl`

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
          <div className="relative">
            <select
              className={selectClass}
              value={platform}
              onChange={e => setPlatform(e.target.value)}
            >
              <option value="">—</option>
              {platforms.data?.map(p => (
                <option key={p.ID} value={p.PlatformName}>
                  {p.PlatformName}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-sm top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        {availableUpdaters.length > 1 && (
          <div className="space-y-2">
            <Label>{t('upload_dialog.updater', { defaultValue: 'Updater' })}</Label>
            <div className="relative">
              <select
                className={selectClass}
                value={updater}
                onChange={(event) => {
                  setUpdater(event.target.value)
                  setSignature('')
                }}
              >
                {availableUpdaters.map(item => (
                  <option key={item.type} value={item.type}>
                    {getUpdaterLabel(item.type)}
                    {item.default ? ` (${t('upload_dialog.default_updater', { defaultValue: 'default' })})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-sm top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
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
          <div className="relative">
            <select className={selectClass} value={arch} onChange={e => setArch(e.target.value)}>
              <option value="">—</option>
              {archs.data?.map(a => (
                <option key={a.ID} value={a.ArchID}>
                  {a.ArchID}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-sm top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
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

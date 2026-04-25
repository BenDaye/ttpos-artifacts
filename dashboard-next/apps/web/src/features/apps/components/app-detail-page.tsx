import type { AppVersion } from '@ttpos/shared'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Boxes, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { Badge } from '@/shared/components/ui/badge'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useAppVersionsQuery } from '../hooks'
import { UploadVersionDialog } from './upload-version-dialog'

export function AppDetailPage({ appName }: { appName: string }) {
  const { t } = useTranslation(['apps', 'common'])
  const [page] = useState(1)
  const versionsQuery = useAppVersionsQuery({ app_name: appName, page, limit: 50 })
  const [uploading, setUploading] = useState(false)

  return (
    <div>
      <PageHeader
        title={appName}
        description={t('detail.description')}
        actions={(
          <div className="flex items-center gap-2">
            <Link to="/applications" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <ArrowLeft className="size-4" />
              {t('detail.back')}
            </Link>
            <Button size="sm" onClick={() => setUploading(true)}>
              <Plus className="size-4" />
              {t('upload', { defaultValue: 'Upload version' })}
            </Button>
          </div>
        )}
      />

      {versionsQuery.isPending && (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {versionsQuery.isError && (
        <EmptyState
          title={t('common:states.error')}
          description={(versionsQuery.error as Error)?.message}
        />
      )}

      {versionsQuery.isSuccess && versionsQuery.data.versions.length === 0 && (
        <EmptyState
          icon={Boxes}
          title={t('detail.empty.title', { defaultValue: 'No versions yet' })}
          description={t('detail.empty.description', {
            defaultValue: 'Upload your first artifact to get started.',
          })}
        />
      )}

      {versionsQuery.isSuccess && versionsQuery.data.versions.length > 0 && (
        <ul className="grid gap-3">
          {versionsQuery.data.versions.map(v => (
            <VersionRow key={v.ID} version={v} />
          ))}
        </ul>
      )}

      <UploadVersionDialog
        open={uploading}
        onOpenChange={setUploading}
        defaultAppName={appName}
      />
    </div>
  )
}

function VersionRow({ version }: { version: AppVersion }) {
  return (
    <li>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{version.Version}</span>
              {version.Channel && <Badge variant="secondary">{version.Channel}</Badge>}
              {version.Platform && <Badge variant="outline">{version.Platform}</Badge>}
              {version.Arch && <Badge variant="outline">{version.Arch}</Badge>}
              {version.Critical && <Badge variant="destructive">Critical</Badge>}
              {!version.Published && <Badge variant="warning">Draft</Badge>}
            </div>
            {version.Updated_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(version.Updated_at).toLocaleString()}
              </p>
            )}
          </div>
          {version.Artifacts && version.Artifacts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {version.Artifacts.map(a => (
                <a
                  key={a.link}
                  href={a.link}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {a.platform}
                  /
                  {a.arch}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  )
}

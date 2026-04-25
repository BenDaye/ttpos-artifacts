import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BootstrapPanel } from '@/features/tuf/components/bootstrap-panel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function TufPanel() {
  const { t } = useTranslation('settings')
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">
              {t('tuf.title', { defaultValue: 'TUF tooling' })}
            </CardTitle>
            <CardDescription>
              {t('tuf.intro', {
                defaultValue: 'Generate Python scripts to bootstrap, sign and rotate TUF metadata. Run scripts locally with the Python tuf CLI.',
              })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t('tuf.note', {
            defaultValue: 'Step-by-step bootstrap and rotate wizards remain on the legacy dashboard during this rollout. The script generators below produce identical output.',
          })}
        </CardContent>
      </Card>

      <BootstrapPanel />
    </div>
  )
}

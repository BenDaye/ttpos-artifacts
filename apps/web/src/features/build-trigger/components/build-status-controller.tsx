import { HammerIcon } from '@phosphor-icons/react'
import { Button } from '@ttpos/ui/components/button'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useBuildActivityStore } from '../build-activity-store'
import { BuildStatusSheet } from './build-status-sheet'

export function BuildStatusController() {
  const { t } = useTranslation('apps')
  const activeBuild = useBuildActivityStore(s => s.activeBuild)
  const statusOpen = useBuildActivityStore(s => s.statusOpen)
  const setStatusOpen = useBuildActivityStore(s => s.setStatusOpen)
  const pruneStaleActiveBuild = useBuildActivityStore(s => s.pruneStaleActiveBuild)

  useEffect(() => {
    pruneStaleActiveBuild()
    const interval = window.setInterval(pruneStaleActiveBuild, 60_000)
    return () => window.clearInterval(interval)
  }, [pruneStaleActiveBuild])

  if (!activeBuild)
    return null

  const statusLabel = t('build_trigger.status_title', { defaultValue: 'Build Status' })

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-label={statusLabel}
        onClick={() => setStatusOpen(true)}
      >
        <HammerIcon />
        <span className="hidden sm:inline">{statusLabel}</span>
      </Button>
      <BuildStatusSheet
        open={statusOpen}
        onOpenChange={setStatusOpen}
        correlationId={activeBuild.correlationId}
        targets={activeBuild.targets}
        runUrl={activeBuild.runUrl}
      />
    </>
  )
}

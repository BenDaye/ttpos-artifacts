import type { TriggerBuildResponse } from '../api'
import { CircleNotchIcon } from '@phosphor-icons/react'
import { Badge } from '@ttpos/ui/components/badge'
import { Button } from '@ttpos/ui/components/button'
import { Checkbox } from '@ttpos/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ttpos/ui/components/dialog'
import { Input } from '@ttpos/ui/components/input'
import { Label } from '@ttpos/ui/components/label'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { appDisplayName, MAX_BUILD_COUNT, packageAlias, platformLabel } from '../constants'
import { useCapabilities, useTriggerBuild } from '../hooks'

// Branch: format/anti-injection guard only (server does the same). The branch is
// a source-repo branch passed through to the build; no allowlist.
const BRANCH_RE = /^[\w./-]+$/

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBuildTriggered: (response: TriggerBuildResponse) => void
}

export function TriggerBuildDialog({ open, onOpenChange, onBuildTriggered }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const trigger = useTriggerBuild()
  const { data: caps, isLoading } = useCapabilities(open)

  const packages = useMemo(() => caps?.packages ?? [], [caps])
  const platforms = useMemo(() => caps?.platforms ?? [], [caps])

  const [selectedPackages, setSelectedPackages] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [branch, setBranch] = useState('')
  const [branchError, setBranchError] = useState<string | null>(null)

  // Build count respects per-package platform availability (e.g. qds is
  // android-only), so an impossible cell is never counted.
  const buildCount = useMemo(() => {
    let n = 0
    for (const pkg of selectedPackages) {
      const cap = packages.find(p => p.package === pkg)
      if (!cap)
        continue
      for (const plat of selectedPlatforms) {
        if (cap.platforms.includes(plat))
          n++
      }
    }
    return n
  }, [selectedPackages, selectedPlatforms, packages])

  const overLimit = buildCount > MAX_BUILD_COUNT

  // Phase 1: single-or-all per axis; a strict subset needs Track 2-b.
  const packageSubset = selectedPackages.length > 1 && selectedPackages.length < packages.length
  const platformSubset = selectedPlatforms.length > 1 && selectedPlatforms.length < platforms.length
  const isSubset = packageSubset || platformSubset

  const canSubmit
    = selectedPackages.length > 0
      && selectedPlatforms.length > 0
      && branch.trim().length > 0
      && buildCount > 0
      && !overLimit
      && !isSubset

  const allPackagesSelected = packages.length > 0 && selectedPackages.length === packages.length
  const allPlatformsSelected = platforms.length > 0 && selectedPlatforms.length === platforms.length
  const appsLabel = t('build_trigger.apps', { defaultValue: '应用端' })

  function togglePackage(value: string) {
    setSelectedPackages(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value])
  }
  function togglePlatform(value: string) {
    setSelectedPlatforms(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value])
  }
  function toggleAllPackages() {
    setSelectedPackages(allPackagesSelected ? [] : packages.map(p => p.package))
  }
  function toggleAllPlatforms() {
    setSelectedPlatforms(allPlatformsSelected ? [] : [...platforms])
  }

  function validateBranch(value: string): string | null {
    if (!value.trim())
      return t('build_trigger.branch_required', { defaultValue: 'Branch is required.' })
    if (value.includes('..') || !BRANCH_RE.test(value))
      return t('build_trigger.branch_invalid', { defaultValue: 'Branch contains invalid characters.' })
    return null
  }

  async function handleSubmit() {
    const err = validateBranch(branch)
    if (err) {
      setBranchError(err)
      return
    }
    setBranchError(null)
    try {
      const response = await trigger.mutateAsync({
        packages: selectedPackages,
        platforms: selectedPlatforms,
        branch: branch.trim(),
      })
      toast.success(t('build_trigger.submit_success', { defaultValue: 'Build triggered successfully' }))
      onOpenChange(false)
      onBuildTriggered(response)
      setSelectedPackages([])
      setSelectedPlatforms([])
      setBranch('')
    }
    catch {
      // handled by useTriggerBuild onError
    }
  }

  function handleOpenChange(next: boolean) {
    if (trigger.isPending)
      return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>{t('build_trigger.title', { defaultValue: '触发测试构建' })}</DialogTitle>
            <DialogDescription>
              {t('build_trigger.description', { defaultValue: '选择应用端和平台，触发 CI 构建测试包。' })}
            </DialogDescription>
          </DialogHeader>

          {isLoading
            ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <CircleNotchIcon className="size-4 animate-spin" />
                  {t('build_trigger.loading_caps', { defaultValue: '加载可构建项…' })}
                </div>
              )
            : (
                <div className="dialog-scroll-area space-y-5">
                  {/* 应用端多选 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{appsLabel}</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={toggleAllPackages}>
                        {allPackagesSelected
                          ? t('build_trigger.deselect_all', { defaultValue: '反选' })
                          : t('build_trigger.select_all', { defaultValue: '全选' })}
                      </Button>
                    </div>
                    <div role="group" aria-label={appsLabel} className="grid grid-cols-2 gap-3">
                      {packages.map(pkg => (
                        <label
                          key={pkg.package}
                          className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                        >
                          <Checkbox
                            checked={selectedPackages.includes(pkg.package)}
                            onCheckedChange={() => togglePackage(pkg.package)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{appDisplayName(pkg.app_name, pkg.package)}</span>
                            <span className="block truncate font-mono text-xs text-muted-foreground">
                              {packageAlias(pkg.package)}
                              {packageAlias(pkg.package) !== pkg.package && (
                                <>
                                  {' / '}
                                  {pkg.package}
                                </>
                              )}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 平台多选 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('build_trigger.platforms', { defaultValue: '平台' })}</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={toggleAllPlatforms}>
                        {allPlatformsSelected
                          ? t('build_trigger.deselect_all', { defaultValue: '反选' })
                          : t('build_trigger.select_all', { defaultValue: '全选' })}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {platforms.map(platform => (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => togglePlatform(platform)}
                          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                            selectedPlatforms.includes(platform)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background hover:bg-muted/50'
                          }`}
                        >
                          {platformLabel(platform)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 分支输入 */}
                  <div className="space-y-2">
                    <Label htmlFor="build-branch">{t('build_trigger.branch', { defaultValue: '分支' })}</Label>
                    <Input
                      id="build-branch"
                      placeholder="new-test"
                      value={branch}
                      onChange={(e) => {
                        setBranch(e.target.value)
                        if (branchError)
                          setBranchError(validateBranch(e.target.value))
                      }}
                      onBlur={() => setBranchError(validateBranch(branch))}
                    />
                    {branchError && <p className="text-xs text-destructive">{branchError}</p>}
                  </div>

                  {/* 环境：只读 */}
                  <div className="space-y-2">
                    <Label>{t('build_trigger.env', { defaultValue: '环境' })}</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">test</Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('build_trigger.env_locked', { defaultValue: '固定 test 不可改' })}
                      </span>
                    </div>
                  </div>

                  {/* 构建数量提示 */}
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span>
                      {t('build_trigger.build_count_simple', {
                        count: buildCount,
                        defaultValue: '将触发 {{count}} 个构建',
                      })}
                    </span>
                    {overLimit && (
                      <p className="mt-1 font-medium text-destructive">
                        {t('build_trigger.over_limit', { max: MAX_BUILD_COUNT, defaultValue: '超过上限 {{max}}，请减少选择' })}
                      </p>
                    )}
                    {isSubset && !overLimit && (
                      <p className="mt-1 text-muted-foreground">
                        {t('build_trigger.subset_hint', { defaultValue: '子集构建即将支持（Track 2-b），请选单个或全部' })}
                      </p>
                    )}
                  </div>
                </div>
              )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={trigger.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit || trigger.isPending || isLoading}>
              {trigger.isPending && <CircleNotchIcon className="animate-spin" />}
              {t('build_trigger.submit', { defaultValue: '触发构建' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

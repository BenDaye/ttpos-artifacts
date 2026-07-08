import type { TriggerBuildResponse } from '../api'
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
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MAX_BUILD_COUNT, PACKAGE_OPTIONS, PLATFORM_OPTIONS } from '../constants'
import { useTriggerBuild } from '../hooks'

// Branch must be non-empty and only contain word chars, dots, slashes, hyphens,
// no ".." sequences allowed (basic frontend guard; real whitelist is server-side)
const BRANCH_RE = /^[\w./-]+$/

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBuildTriggered: (response: TriggerBuildResponse) => void
}

export function TriggerBuildDialog({ open, onOpenChange, onBuildTriggered }: Props) {
  const { t } = useTranslation(['apps', 'common'])
  const trigger = useTriggerBuild()

  const [selectedPackages, setSelectedPackages] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [branch, setBranch] = useState('')
  const [branchError, setBranchError] = useState<string | null>(null)

  const buildCount = selectedPackages.length * selectedPlatforms.length
  const overLimit = buildCount > MAX_BUILD_COUNT

  // Capability gate: subset means: not 1 and not all (for either axis)
  const packageSubset
    = selectedPackages.length > 1 && selectedPackages.length < PACKAGE_OPTIONS.length
  const platformSubset
    = selectedPlatforms.length > 1 && selectedPlatforms.length < PLATFORM_OPTIONS.length
  const isSubset = packageSubset || platformSubset

  const canSubmit
    = selectedPackages.length > 0
      && selectedPlatforms.length > 0
      && branch.trim().length > 0
      && !overLimit
      && !isSubset

  function togglePackage(value: string) {
    setSelectedPackages(prev =>
      prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value],
    )
  }

  function togglePlatform(value: string) {
    setSelectedPlatforms(prev =>
      prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value],
    )
  }

  function selectAllPackages() {
    setSelectedPackages(PACKAGE_OPTIONS.map(p => p.value))
  }

  function deselectAllPackages() {
    setSelectedPackages([])
  }

  function toggleAllPackages() {
    if (selectedPackages.length === PACKAGE_OPTIONS.length) {
      deselectAllPackages()
    }
    else {
      selectAllPackages()
    }
  }

  function selectAllPlatforms() {
    setSelectedPlatforms([...PLATFORM_OPTIONS])
  }

  function deselectAllPlatforms() {
    setSelectedPlatforms([])
  }

  function toggleAllPlatforms() {
    if (selectedPlatforms.length === PLATFORM_OPTIONS.length) {
      deselectAllPlatforms()
    }
    else {
      selectAllPlatforms()
    }
  }

  function validateBranch(value: string): string | null {
    if (!value.trim()) {
      return t('build_trigger.branch_required', { defaultValue: 'Branch is required.' })
    }
    if (value.includes('..')) {
      return t('build_trigger.branch_invalid', { defaultValue: 'Branch contains invalid characters.' })
    }
    if (!BRANCH_RE.test(value)) {
      return t('build_trigger.branch_invalid', { defaultValue: 'Branch contains invalid characters.' })
    }
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
      // Reset form
      setSelectedPackages([])
      setSelectedPlatforms([])
      setBranch('')
    }
    catch {
      // Error toast is handled by useTriggerBuild's onError
    }
  }

  function handleOpenChange(next: boolean) {
    if (trigger.isPending)
      return
    onOpenChange(next)
  }

  const allPackagesSelected = selectedPackages.length === PACKAGE_OPTIONS.length
  const allPlatformsSelected = selectedPlatforms.length === PLATFORM_OPTIONS.length

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

          <div className="dialog-scroll-area space-y-5">
            {/* 应用端多选 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('build_trigger.apps', { defaultValue: '应用端' })}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={toggleAllPackages}
                >
                  {allPackagesSelected
                    ? t('build_trigger.deselect_all', { defaultValue: '反选' })
                    : t('build_trigger.select_all', { defaultValue: '全选' })}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {PACKAGE_OPTIONS.map(pkg => (
                  <label
                    key={pkg.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <Checkbox
                      checked={selectedPackages.includes(pkg.value)}
                      onCheckedChange={() => togglePackage(pkg.value)}
                    />
                    <span className="font-medium">{pkg.label}</span>
                    <span className="text-muted-foreground">
                      (
                      {pkg.value}
                      )
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 平台多选 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('build_trigger.platforms', { defaultValue: '平台' })}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={toggleAllPlatforms}
                >
                  {allPlatformsSelected
                    ? t('build_trigger.deselect_all', { defaultValue: '反选' })
                    : t('build_trigger.select_all', { defaultValue: '全选' })}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map(platform => (
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
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            {/* 分支输入 */}
            <div className="space-y-2">
              <Label htmlFor="build-branch">
                {t('build_trigger.branch', { defaultValue: '分支' })}
              </Label>
              <Input
                id="build-branch"
                placeholder="main"
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value)
                  if (branchError) {
                    setBranchError(validateBranch(e.target.value))
                  }
                }}
                onBlur={() => setBranchError(validateBranch(branch))}
              />
              {branchError && (
                <p className="text-xs text-destructive">{branchError}</p>
              )}
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
                {t('build_trigger.build_count', {
                  packages: selectedPackages.length,
                  platforms: selectedPlatforms.length,
                  count: buildCount,
                  defaultValue: '{{packages}} 端 × {{platforms}} 平台 = {{count}} 个构建',
                })}
              </span>
              {overLimit && (
                <p className="mt-1 font-medium text-destructive">
                  {t('build_trigger.over_limit', { max: MAX_BUILD_COUNT, defaultValue: '超过上限 {{max}}，请减少选择' })}
                </p>
              )}
              {isSubset && !overLimit && (
                <p className="mt-1 text-muted-foreground">
                  {t('build_trigger.subset_hint', {
                    defaultValue: '子集构建即将支持（Track 2-b），请选单个或全部',
                  })}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={trigger.isPending}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit || trigger.isPending}>
              {trigger.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('build_trigger.submit', { defaultValue: '触发构建' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

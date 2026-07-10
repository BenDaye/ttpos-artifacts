import type { BuildTarget, TriggerBuildResponse } from './api'
import { create } from 'zustand'
import { BUILD_TIMEOUT_MS } from './hooks'

const STORAGE_KEY = 'buildActivity.active'

export interface ActiveBuild {
  correlationId: string
  targets: BuildTarget[]
  runUrl?: string
  startedAt: number
}

interface BuildActivityState {
  activeBuild: ActiveBuild | null
  statusOpen: boolean
  setActiveBuildFromResponse: (response: TriggerBuildResponse) => void
  setStatusOpen: (open: boolean) => void
  clearActiveBuild: () => void
  pruneStaleActiveBuild: () => void
}

function isBuildTarget(value: unknown): value is BuildTarget {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as BuildTarget).package === 'string'
    && typeof (value as BuildTarget).app_name === 'string'
    && typeof (value as BuildTarget).platform === 'string',
  )
}

function isActiveBuild(value: unknown): value is ActiveBuild {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as ActiveBuild).correlationId === 'string'
    && typeof (value as ActiveBuild).startedAt === 'number'
    && Array.isArray((value as ActiveBuild).targets)
    && (value as ActiveBuild).targets.every(isBuildTarget)
    && (
      (value as ActiveBuild).runUrl === undefined
      || typeof (value as ActiveBuild).runUrl === 'string'
    ),
  )
}

function isFreshBuild(build: ActiveBuild): boolean {
  const age = Date.now() - build.startedAt
  return age >= 0 && age <= BUILD_TIMEOUT_MS
}

function readStoredActiveBuild(): ActiveBuild | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw)
      return null
    const parsed = JSON.parse(raw)
    if (!isActiveBuild(parsed) || !isFreshBuild(parsed)) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  }
  catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function writeStoredActiveBuild(build: ActiveBuild | null) {
  try {
    if (!build) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(build))
  }
  catch {
    /* ignored */
  }
}

export const useBuildActivityStore = create<BuildActivityState>((set, get) => ({
  activeBuild: readStoredActiveBuild(),
  statusOpen: false,
  setActiveBuildFromResponse: (response) => {
    const activeBuild: ActiveBuild = {
      correlationId: response.correlation_id,
      targets: response.targets,
      runUrl: response.run_url,
      startedAt: Date.now(),
    }
    writeStoredActiveBuild(activeBuild)
    set({ activeBuild, statusOpen: true })
  },
  setStatusOpen: (open) => {
    set(state => ({
      statusOpen: Boolean(state.activeBuild) && open,
    }))
  },
  clearActiveBuild: () => {
    writeStoredActiveBuild(null)
    set({ activeBuild: null, statusOpen: false })
  },
  pruneStaleActiveBuild: () => {
    const { activeBuild, clearActiveBuild } = get()
    if (activeBuild && !isFreshBuild(activeBuild)) {
      clearActiveBuild()
    }
  },
}))

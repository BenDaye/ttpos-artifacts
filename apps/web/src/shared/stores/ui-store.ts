import type { LayoutMode } from '@ttpos/shared'
import { STORAGE_KEYS } from '@ttpos/shared'
import { create } from 'zustand'

interface UiState {
  sidebarCollapsed: boolean
  layout: LayoutMode
  toggleSidebar: () => void
  setLayout: (layout: LayoutMode) => void
}

function readLayout(): LayoutMode {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.LAYOUT_PREFERENCE)
    if (value === 'card' || value === 'list' || value === 'board') {
      return value
    }
  }
  catch {
    /* swallow */
  }
  return 'card'
}

function persistLayout(layout: LayoutMode) {
  try {
    localStorage.setItem(STORAGE_KEYS.LAYOUT_PREFERENCE, layout)
  }
  catch {
    /* swallow */
  }
}

export const useUiStore = create<UiState>(set => ({
  sidebarCollapsed: false,
  layout: readLayout(),
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setLayout: (layout) => {
    persistLayout(layout)
    set({ layout })
  },
}))

import { useState, useCallback } from "react";
import {
  type LayoutMode,
  LAYOUT_STORAGE_KEY,
  DEFAULT_LAYOUT,
} from "../components/layouts/types";

function isValidLayout(value: string): value is LayoutMode {
  return value === "card" || value === "list" || value === "board";
}

function readStoredLayout(): LayoutMode {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (stored && isValidLayout(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_LAYOUT;
}

export function useLayoutPreference(): readonly [LayoutMode, (mode: LayoutMode) => void] {
  const [layout, setLayoutState] = useState<LayoutMode>(readStoredLayout);

  const setLayout = useCallback((mode: LayoutMode) => {
    setLayoutState(mode);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return [layout, setLayout] as const;
}

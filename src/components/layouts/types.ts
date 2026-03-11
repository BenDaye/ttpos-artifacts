import React from "react";
import type { AppListItem } from "../../hooks/use-query/useAppsQuery";

export type LayoutMode = "card" | "list" | "board";

export const LAYOUT_STORAGE_KEY = "dashboard-layout-preference";

export const DEFAULT_LAYOUT: LayoutMode = "card";

export interface AppLayoutViewProps {
  apps: AppListItem[];
  isLoading: boolean;
  searchTerm: string;
  onAppClick: (appName: string) => void;
  onEditApp: (e: React.MouseEvent, app: AppListItem) => void;
  onDeleteApp: (e: React.MouseEvent, app: AppListItem) => void;
  expandedApps: Record<string, boolean>;
  onToggleExpand: (e: React.MouseEvent, appId: string) => void;
}

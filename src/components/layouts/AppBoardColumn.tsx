import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppVersionsQuery } from "../../hooks/use-query/useAppVersionsQuery";
import { ActionIcons } from "../ActionIcons";
import type { AppListItem, AppVersion } from "../../hooks/use-query/useAppsQuery";

interface AppBoardColumnProps {
  app: AppListItem;
  onAppClick: (appName: string) => void;
  onEditApp: (e: React.MouseEvent, app: AppListItem) => void;
  onDeleteApp: (e: React.MouseEvent, app: AppListItem) => void;
  onEditVersion: (version: AppVersion) => void;
  onDeleteVersion: (version: AppVersion) => void;
  onDownloadVersion: (version: AppVersion) => void;
}

export const AppBoardColumn: React.FC<AppBoardColumnProps> = ({
  app,
  onAppClick,
  onEditApp,
  onDeleteApp,
  onEditVersion,
  onDeleteVersion,
  onDownloadVersion,
}) => {
  const { versions, total, isLoading, isError } = useAppVersionsQuery(app.AppName);

  return (
    <div className="flex flex-col w-[340px] min-w-[340px] bg-muted/30 border border-border rounded-lg flex-shrink-0">
      {/* Column header — app info + app actions */}
      <div
        className="px-4 py-3 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg"
        onClick={() => onAppClick(app.AppName)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {app.Logo ? (
              <img
                src={app.Logo}
                alt={`${app.AppName} logo`}
                className="w-full h-full object-contain"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.opacity = "0";
                  setTimeout(() => {
                    target.src =
                      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Q0E2RkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxwYXRoIGQ9Ik0xMiA4djgiPjwvcGF0aD48cGF0aCBkPSJNOCAxMmg4Ij48L3BhdGg+PC9zdmc+";
                    target.style.opacity = "1";
                  }, 300);
                }}
                onLoad={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.opacity = "1";
                }}
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate" title={app.AppName}>
                {app.AppName}
              </h3>
              {app.Tuf && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary flex-shrink-0">
                  TUF
                </span>
              )}
              {app.Private && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-destructive/10 text-destructive flex-shrink-0">
                  Private
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              {total} version{total !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 self-center">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => onEditApp(e, app)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Edit app"
            >
              <i className="fas fa-edit text-xs" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => onDeleteApp(e, app)}
              className="h-7 w-7 text-destructive hover:text-destructive"
              title="Delete app"
            >
              <i className="fas fa-trash text-xs" />
            </Button>
          </div>
        </div>
      </div>

      {/* Version cards — each card has version-level actions */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-280px)]">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-muted border-t-primary" />
          </div>
        ) : isError ? (
          <div className="text-center text-destructive text-xs py-6">
            Failed to load versions
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-6">
            No versions
          </div>
        ) : (
          versions.map((version) => (
            <Card
              key={version.ID}
              className="hover:border-muted-foreground/30 transition-colors"
            >
              <CardHeader className="p-2.5 pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {version.Version}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground flex-shrink-0">
                      {version.Channel}
                    </span>
                  </div>
                  <div className="flex-shrink-0 scale-75 origin-right -mr-1">
                    <ActionIcons
                      onDownload={() => onDownloadVersion(version)}
                      onEdit={() => onEditVersion(version)}
                      onDelete={() => onDeleteVersion(version)}
                      showDownload={
                        version.Artifacts?.length === 1
                          ? !!version.Artifacts[0].link
                          : (version.Artifacts?.length ?? 0) > 0
                      }
                      artifactLink={
                        version.Artifacts?.length === 1
                          ? version.Artifacts[0].link
                          : undefined
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2.5 pt-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      version.Published
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {version.Published ? "Published" : "Draft"}
                  </span>
                  {version.Critical && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                      Critical
                    </span>
                  )}
                  {version.Artifacts?.length > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {version.Artifacts.length} artifact
                      {version.Artifacts.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {version.Changelog?.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                    {version.Changelog[0].Changes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

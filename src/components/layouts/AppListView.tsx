import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AppLayoutViewProps } from "./types";

export const AppListView: React.FC<AppLayoutViewProps> = ({
  apps,
  isLoading,
  searchTerm,
  onAppClick,
  onEditApp,
  onDeleteApp,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!apps || apps.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        {searchTerm
          ? "No applications found matching your search."
          : "No applications have been created yet."}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header row */}
      <div className="hidden md:grid grid-cols-[auto_1fr_2fr_auto_auto] gap-4 items-center px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="w-8" />
        <div>Name</div>
        <div>Description</div>
        <div>Badges</div>
        <div className="w-[72px] text-right">Actions</div>
      </div>

      {/* Rows */}
      {apps.map((app, index) => (
        <div
          key={app.ID}
          onClick={() => onAppClick(app.AppName)}
          className={`grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_2fr_auto_auto] gap-4 items-center px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors ${
            index < apps.length - 1 ? "border-b border-border" : ""
          }`}
        >
          {/* Logo */}
          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
                width="16"
                height="16"
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

          {/* Name + badges (mobile: combined) */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="font-medium text-sm truncate"
              title={app.AppName}
            >
              {app.AppName}
            </span>
            {app.Private && (
              <span className="md:hidden inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-destructive/10 text-destructive">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>
            )}
            {app.Tuf && (
              <span className="md:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                TUF
              </span>
            )}
          </div>

          {/* Description (desktop only) */}
          <p className="hidden md:block text-sm text-muted-foreground truncate">
            {app.Description || "No description available"}
          </p>

          {/* Badges (desktop only) */}
          <div className="hidden md:flex items-center gap-1.5">
            {app.Tuf && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                TUF
              </span>
            )}
            {app.Private && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Private
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0 justify-end">
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
      ))}
    </Card>
  );
};

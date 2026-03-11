import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AppLayoutViewProps } from "./types";

export const AppCardView: React.FC<AppLayoutViewProps> = ({
  apps,
  isLoading,
  searchTerm,
  onAppClick,
  onEditApp,
  onDeleteApp,
  expandedApps,
  onToggleExpand,
}) => {
  if (isLoading) {
    return (
      <div className="col-span-full flex justify-center items-center h-64">
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {apps.map((app) => (
        <Card
          key={app.ID}
          onClick={() => onAppClick(app.AppName)}
          className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
        >
          <CardHeader className="p-4">
            <div className="flex items-center min-w-0 w-full">
              <div className="relative w-10 h-10 flex-shrink-0">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                  {app.Logo ? (
                    <img
                      src={app.Logo}
                      alt={`${app.AppName} logo`}
                      className="w-full h-full object-contain transition-opacity duration-300"
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
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground w-full h-full"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <path d="M12 8v8" />
                      <path d="M8 12h8" />
                    </svg>
                  )}
                </div>
                {app.Private && (
                  <div className="absolute -bottom-1 -right-1 bg-destructive rounded-full p-1 z-10">
                    <svg
                      className="w-3 h-3 text-primary-foreground"
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
                  </div>
                )}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <h3
                  className="text-base font-semibold truncate max-w-[200px] overflow-hidden"
                  title={app.AppName}
                >
                  {app.AppName}
                </h3>
                {app.Tuf && (
                  <div className="mt-1 flex items-center gap-1">
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
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0 ml-auto">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => onEditApp(e, app)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Edit app"
                >
                  <i className="fas fa-edit text-sm" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => onDeleteApp(e, app)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Delete app"
                >
                  <i className="fas fa-trash text-sm" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-2">
              <p
                className={`text-sm text-muted-foreground flex-1 ${
                  !expandedApps[app.ID] && "line-clamp-1"
                }`}
              >
                {app.Description || "No description available"}
              </p>
              {app.Description && app.Description.length > 50 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => onToggleExpand(e, app.ID)}
                  className="h-6 w-6 flex-shrink-0"
                  title={expandedApps[app.ID] ? "Collapse" : "Expand"}
                >
                  <i
                    className={`fas ${
                      expandedApps[app.ID]
                        ? "fa-chevron-up"
                        : "fa-chevron-down"
                    } text-muted-foreground text-xs`}
                  />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

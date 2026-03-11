import React from "react";
import { AppBoardColumn } from "./AppBoardColumn";
import type { AppLayoutViewProps } from "./types";
import type { AppVersion } from "../../hooks/use-query/useAppsQuery";

interface AppBoardViewProps extends AppLayoutViewProps {
  onEditVersion: (version: AppVersion) => void;
  onDeleteVersion: (version: AppVersion) => void;
  onDownloadVersion: (version: AppVersion) => void;
}

export const AppBoardView: React.FC<AppBoardViewProps> = ({
  apps,
  isLoading,
  searchTerm,
  onAppClick,
  onEditApp,
  onDeleteApp,
  onEditVersion,
  onDeleteVersion,
  onDownloadVersion,
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
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-min">
        {apps.map((app) => (
          <AppBoardColumn
            key={app.ID}
            app={app}
            onAppClick={onAppClick}
            onEditApp={onEditApp}
            onDeleteApp={onDeleteApp}
            onEditVersion={onEditVersion}
            onDeleteVersion={onDeleteVersion}
            onDownloadVersion={onDownloadVersion}
          />
        ))}
      </div>
    </div>
  );
};

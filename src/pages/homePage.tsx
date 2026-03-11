"use client";
import React from "react";
import { AppLayout } from "../components/AppLayout";
import { Dashboard } from "../components/Dashboard";
import { UploadModal } from "../components/UploadModal";
import { ChangelogModal } from "../components/ChangelogModal";
import { CreateAppModal } from "../components/CreateAppModal";
import { ChangelogEntry } from "../hooks/use-query/useAppsQuery";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLayoutPreference } from "../hooks/useLayoutPreference";
import { LayoutSwitcher } from "../components/layouts/LayoutSwitcher";

export const HomePage = () => {
  const { appName } = useParams();
  const navigate = useNavigate();
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [showCreateAppModal, setShowCreateAppModal] = React.useState(false);
  const [selectedApp, setSelectedApp] = React.useState<string | null>(appName || null);
  const [showChangelogModal, setShowChangelogModal] = React.useState(false);
  const [selectedVersion, setSelectedVersion] = React.useState<string | null>(null);
  const [selectedChangelog, setSelectedChangelog] = React.useState<ChangelogEntry[]>([]);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [layout, setLayout] = useLayoutPreference();

  React.useEffect(() => {
    setSelectedApp(appName || null);
  }, [appName]);

  const toggleUploadModal = () => setShowUploadModal((v) => !v);
  const toggleCreateAppModal = () => setShowCreateAppModal((v) => !v);

  const handleAppClick = (name: string) => {
    setSelectedApp(name);
    navigate(`/applications/${name}`);
  };

  const handleBackClick = () => {
    setSelectedApp(null);
    navigate("/applications");
  };

  const handleChangelogClick = (version: string, changelog: ChangelogEntry[]) => {
    setSelectedVersion(version);
    setSelectedChangelog(changelog);
    setShowChangelogModal(true);
  };

  const closeChangelogModal = () => {
    setShowChangelogModal(false);
    setSelectedVersion(null);
    setSelectedChangelog([]);
  };

  const handleCreateAppSuccess = () => setRefreshKey((prev) => prev + 1);

  return (
    <AppLayout
      title="Applications"
      onCreateClick={toggleUploadModal}
      createButtonText="Upload the app"
      hideSearch={!!selectedApp}
      onSearchChange={(term) => setSearchTerm(term)}
      additionalButton={
        <div className="flex items-center gap-2">
          {!selectedApp && <LayoutSwitcher value={layout} onChange={setLayout} />}
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleCreateAppModal}
            aria-label="Create app"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline ml-2">Create app</span>
          </Button>
        </div>
      }
    >
      <Dashboard
        selectedApp={selectedApp}
        onAppClick={handleAppClick}
        onChangelogClick={handleChangelogClick}
        onBackClick={handleBackClick}
        refreshKey={refreshKey}
        searchTerm={searchTerm}
        layout={layout}
      />
      {showUploadModal && (
        <UploadModal onClose={toggleUploadModal} />
      )}
      {showCreateAppModal && (
        <CreateAppModal 
          onClose={toggleCreateAppModal} 
          onSuccess={handleCreateAppSuccess}
        />
      )}
      {showChangelogModal && selectedVersion && selectedApp && (
        <ChangelogModal
          appName={selectedApp}
          version={selectedVersion}
          changelog={selectedChangelog}
          onClose={closeChangelogModal}
        />
      )}
    </AppLayout>
  );
};

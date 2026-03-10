import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppLayoutProps {
  title: string;
  onCreateClick: () => void;
  createButtonText: string;
  onSearchChange?: (term: string) => void;
  hideSearch?: boolean;
  additionalButton?: React.ReactNode;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  onCreateClick,
  createButtonText,
  onSearchChange,
  hideSearch = false,
  additionalButton,
  children,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="flex">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 min-w-0 p-6 lg:p-8">
          <Header
            title={title}
            onCreateClick={onCreateClick}
            createButtonText={createButtonText}
            additionalButton={additionalButton}
            onSearchChange={onSearchChange}
            hideSearch={hideSearch}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

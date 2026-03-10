import React from "react";
import { useOutletContext } from "react-router-dom";
import { Header } from "./Header";
import type { MainLayoutContext } from "./MainLayout";

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
  const { onMenuClick } = useOutletContext<MainLayoutContext>();

  return (
    <>
      <Header
        title={title}
        onCreateClick={onCreateClick}
        createButtonText={createButtonText}
        additionalButton={additionalButton}
        onSearchChange={onSearchChange}
        hideSearch={hideSearch}
        onMenuClick={onMenuClick}
      />
      <div className="mt-6">{children}</div>
    </>
  );
};

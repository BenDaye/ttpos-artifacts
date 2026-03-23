import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export interface MainLayoutContext {
  onMenuClick: () => void;
}

export const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="flex">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 min-w-0 p-6 lg:p-8">
          <Outlet context={{ onMenuClick: () => setIsSidebarOpen(true) } satisfies MainLayoutContext} />
        </main>
      </div>
    </div>
  );
};

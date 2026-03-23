import React, { useState, useEffect } from 'react';
import { AppListItem } from '../../../hooks/use-query/useAppsQuery';

interface AppSelectionProps {
  apps: AppListItem[];
  selectedApp: string;
  onAppChange: (appName: string) => void;
  onResetStates: () => void;
}

export const AppSelection: React.FC<AppSelectionProps> = ({
  apps,
  selectedApp,
  onAppChange,
  onResetStates,
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Filter apps with Tuf: true
  const tufApps = React.useMemo(() => {
    if (!Array.isArray(apps)) return [];
    return apps.filter(app => app.Tuf === true);
  }, [apps]);

  // Handle dropdown clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAppSelect = (appName: string) => {
    onAppChange(appName);
    setOpenDropdown(null);
    onResetStates();
  };

  return (
    <div className="bg-card p-4 rounded-lg border border-border">
      <label className="block text-foreground mb-2 font-roboto font-semibold">
        Select App
      </label>
      <div className="relative dropdown-container">
        <button
          type="button"
          onClick={() => setOpenDropdown(openDropdown === 'app' ? null : 'app')}
          className="w-full min-w-0 bg-muted text-foreground border border-border rounded-lg px-4 py-2 pr-8 flex items-center justify-between hover:bg-accent transition-all duration-150"
        >
          <span className="block min-w-0 flex-1 truncate text-left">{selectedApp || 'Select an app with TUF enabled'}</span>
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
            className={`text-foreground transition-transform flex-shrink-0 ml-2 ${openDropdown === 'app' ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        {openDropdown === 'app' && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card backdrop-blur-lg rounded-lg shadow-lg z-10 border border-border max-h-60 overflow-y-auto">
            {tufApps.length > 0 ? (
              tufApps.map((app) => (
                <button
                  key={app.ID}
                  type="button"
                  onClick={() => handleAppSelect(app.AppName)}
                  className={`w-full text-left truncate px-4 py-2 text-foreground hover:bg-accent transition-colors ${
                    selectedApp === app.AppName ? 'bg-primary bg-opacity-50' : ''
                  }`}
                >
                  {app.AppName}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-foreground text-center">
                No apps with TUF enabled found
              </div>
            )}
          </div>
        )}
      </div>
      {tufApps.length > 0 && (
        <p className="text-sm text-foreground opacity-70 mt-2">
          <i className="fas fa-info-circle mr-1"></i>
          Only apps with TUF enabled are shown
        </p>
      )}
    </div>
  );
};

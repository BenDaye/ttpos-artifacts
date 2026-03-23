import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { UsersSettings } from '../components/settings/UsersSettings';
import { TufSettings } from '../components/settings/TufSettings';
import { TokenSettings } from '../components/settings/TokenSettings';

type SettingsPage = 'users' | 'tokens' | 'tuf';

export const SettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine current page from URL or default to 'users'
  const getCurrentPage = (): SettingsPage => {
    if (location.pathname === '/settings/tuf') {
      return 'tuf';
    }
    if (location.pathname === '/settings/tokens') {
      return 'tokens';
    }
    return 'users';
  };
  
  const [currentPage, setCurrentPage] = useState<SettingsPage>(getCurrentPage());

  // Update current page when location changes
  useEffect(() => {
    const page = getCurrentPage();
    setCurrentPage(page);
  }, [location.pathname]);

  const menuItems = [
    { id: 'users' as SettingsPage, label: 'Users', icon: 'fa-users' },
    { id: 'tokens' as SettingsPage, label: 'CI/CD Tokens', icon: 'fa-key' },
    { id: 'tuf' as SettingsPage, label: 'TUF', icon: 'fa-shield-alt' },
  ];

  const handlePageChange = (page: SettingsPage) => {
    setCurrentPage(page);
    if (page === 'tuf') {
      navigate('/settings/tuf');
    } else if (page === 'tokens') {
      navigate('/settings/tokens');
    } else {
      navigate('/settings');
    }
  };

  return (
    <AppLayout title="Settings" onCreateClick={() => {}} createButtonText="" hideSearch>
      <div className="mt-6">
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <div className="mb-6 border-b border-border">
            <nav className="flex gap-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handlePageChange(item.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                    currentPage === item.id
                      ? "bg-primary text-primary-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <i className={`fas ${item.icon} mr-2`}></i>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-6">
            {currentPage === "users" && <UsersSettings />}
            {currentPage === "tokens" && <TokenSettings />}
            {currentPage === "tuf" && <TufSettings />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};


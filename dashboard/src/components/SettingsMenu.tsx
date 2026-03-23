import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/authProvider';
import { useUsersQuery } from '../hooks/use-query/useUsersQuery';

interface SettingsMenuProps {
  onClose: () => void;
  onOpenProfileModal: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  onClose,
  onOpenProfileModal,
}) => {
  const navigate = useNavigate();
  const menuRef = React.useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const { data: userData } = useUsersQuery();
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });

  React.useEffect(() => {
    // Calculate position for the menu
    const settingsButton = document.querySelector(
      '[aria-label="Settings"]'
    ) as HTMLElement;
    if (settingsButton) {
      const rect = settingsButton.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const settingsButton = document.querySelector('[aria-label="Settings"]');
      if (settingsButton?.contains(event.target as Node)) {
        return;
      }

      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleProfileClick = () => {
    onClose();
    onOpenProfileModal();
  };

  const handleSettingsClick = () => {
    onClose();
    // Navigate to Settings page
    navigate('/settings');
  };

  const menuContent = (
    <div
      ref={menuRef}
      className='settings-popup animate-fade-in settings-menu-popup'
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: menuPosition.top,
        right: menuPosition.right,
        minWidth: '12rem',
      }}>
      {userData && (
        <>
          <div className='settings-popup-user'>
            <span>{userData.username}</span>
            <i
              className={`fas ${userData.is_admin ? 'fa-crown text-yellow-500' : 'fa-user text-blue-500'}`}></i>
          </div>
          <div className='settings-popup-divider'></div>
        </>
      )}
      <button onClick={handleProfileClick} className='settings-popup-button'>
        <i className='fas fa-user'></i>
        <span>Profile</span>
      </button>
      {userData?.is_admin && (
        <button onClick={handleSettingsClick} className='settings-popup-button'>
          <i className='fas fa-cog'></i>
          <span>Settings</span>
        </button>
      )}
      <div className='settings-popup-divider'></div>
      <button onClick={handleLogout} className='settings-popup-button danger'>
        <i className='fas fa-sign-out-alt'></i>
        <span>Logout</span>
      </button>
    </div>
  );

  return <>{createPortal(menuContent, document.body)}</>;
};

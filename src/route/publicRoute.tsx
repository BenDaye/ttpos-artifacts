import { FC } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/authProvider.tsx';

export const PublicRoute: FC = () => {
  const { token } = useAuth();
  const location = useLocation();

  if (token) {
    const from = location.state?.from || '/';
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
};

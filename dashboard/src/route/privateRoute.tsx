import { FC } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/authProvider.tsx';

export const PrivateRoute: FC = () => {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/signin" state={{ from: location.pathname + location.search }} replace />;
  }

  return <Outlet />;
};

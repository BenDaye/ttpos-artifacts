import { createBrowserRouter, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { PrivateRoute } from './privateRoute.tsx';
import { PublicRoute } from './publicRoute.tsx';
import { AuthProvider } from '../providers/authProvider.tsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MainLayout } from '../components/MainLayout';

const SignInPage = lazy(() => import('../pages/signInPage.tsx').then(module => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('../pages/signUpPage.tsx').then(module => ({ default: module.SignUpPage })));
const HomePage = lazy(() => import('../pages/homePage.tsx').then(module => ({ default: module.HomePage })));
const ChannelsPage = lazy(() => import('../pages/channelsPage.tsx').then(module => ({ default: module.ChannelsPage })));
const PlatformsPage = lazy(() => import('../pages/platformsPage.tsx').then(module => ({ default: module.PlatformsPage })));
const ArchitecturesPage = lazy(() => import('../pages/architecturesPage.tsx').then(module => ({ default: module.ArchitecturesPage })));
const StatisticsPage = lazy(() => import('../pages/StatisticsPage.tsx').then(module => ({ default: module.StatisticsPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage.tsx').then(module => ({ default: module.SettingsPage })));

const RootLayout = () => (
  <AuthProvider>
    <ToastContainer />
    <Suspense fallback={<LoadingSpinner />}>
      <Outlet />
    </Suspense>
  </AuthProvider>
);

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PrivateRoute />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { path: '/', element: <HomePage /> },
              { path: '/applications', element: <HomePage /> },
              { path: '/applications/:appName', element: <HomePage /> },
              { path: '/channels', element: <ChannelsPage /> },
              { path: '/platforms', element: <PlatformsPage /> },
              { path: '/architectures', element: <ArchitecturesPage /> },
              { path: '/statistics', element: <StatisticsPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '/settings/tuf', element: <SettingsPage /> },
              { path: '/settings/tokens', element: <SettingsPage /> },
            ],
          },
        ],
      },
      {
        element: <PublicRoute />,
        children: [
          { path: '/signin', element: <SignInPage /> },
          { path: '/signup', element: <SignUpPage /> },
        ],
      },
    ],
  },
]);

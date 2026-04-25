import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Suspense } from 'react'
import { ErrorBoundary } from '@/shared/components/error-boundary'
import { LoadingSpinner } from '@/shared/components/loading-spinner'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2">
      <p className="text-2xl font-semibold">404</p>
      <p className="text-muted-foreground">Page not found</p>
    </div>
  ),
})

function RootComponent() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  )
}

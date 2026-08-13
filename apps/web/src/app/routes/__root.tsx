import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Spinner } from '@ttpos/ui/components/spinner'
import { Suspense } from 'react'
import { ErrorBoundary } from '@/shared/components/error-boundary'

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
      <Suspense fallback={(
        <div className="flex min-h-svh items-center justify-center text-muted-foreground">
          <Spinner className="size-6" />
        </div>
      )}
      >
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  )
}

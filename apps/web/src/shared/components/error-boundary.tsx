import type { PropsWithChildren } from 'react'
import { Component } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error) {
    console.error('UI error captured:', error)
  }

  reset = () => {
    this.setState({ error: null })
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

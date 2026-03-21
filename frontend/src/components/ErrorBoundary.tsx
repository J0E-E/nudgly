/**
 * React error boundary: catches unrecoverable errors in children
 * and renders a fallback UI.
 */

import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main id="error-boundary-fallback" className="error-boundary-fallback">
          <h1 id="error-boundary-title">Something went wrong</h1>
          <p id="error-boundary-message" className="error-boundary-message">
            An unexpected error occurred. Please try again.
          </p>
          <button
            id="error-boundary-retry-btn"
            type="button"
            className="error-boundary-retry"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </main>
      )
    }

    return this.props.children
  }
}

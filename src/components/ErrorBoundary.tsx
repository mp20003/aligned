/**
 * ErrorBoundary
 *
 * Catches render-time errors anywhere below it and shows a recovery screen
 * instead of a blank white page. Never swallows the error silently — it's
 * always logged to the console. Reload re-mounts the whole app from scratch;
 * it does not attempt to recover in place, since the error may have left
 * React state inconsistent.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Triova crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: '#0f0f1a' }}
      >
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <svg width="32" height="32" viewBox="0 0 22 22" fill="none" strokeLinecap="round" aria-hidden="true">
            <path d="M 11,2 A 9,9 0 0,1 18.79,15.5" stroke="#1D9E75" strokeWidth="2" opacity="0.4" />
            <path d="M 18.79,15.5 A 9,9 0 0,1 3.21,15.5" stroke="#7F77DD" strokeWidth="2" opacity="0.4" />
            <path d="M 3.21,15.5 A 9,9 0 0,1 11,2" stroke="#D85A30" strokeWidth="2" opacity="0.4" />
          </svg>
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-2xl text-white">Something went wrong</h1>
            <p className="font-sans text-sm text-white/50 leading-relaxed">
              Triova hit a snag. Your last saved wins are safe — reloading should fix it.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3.5 rounded-2xl font-sans text-sm text-white tracking-wide btn-lift"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Reload Triova
          </button>
        </div>
      </div>
    )
  }
}

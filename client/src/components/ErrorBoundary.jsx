/**
 * client/src/components/ErrorBoundary.jsx
 *
 * Global React error boundary. Catches rendering errors anywhere in the tree
 * and shows a friendly fallback UI instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production you'd send this to Sentry / LogRocket etc.
    console.error('[ErrorBoundary] Caught rendering error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = import.meta.env.DEV
      ? this.state.error?.message || 'Unknown error'
      : 'An unexpected error occurred.';

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F8F5] px-6 font-sans">
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-10 shadow-xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 border border-rose-200">
            <AlertTriangle className="h-7 w-7 text-rose-500" />
          </div>
          <h1 className="text-xl font-black text-[#111111] tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-[#111111]/50 leading-relaxed">{message}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#111111]/15 bg-[#F8F8F5] px-5 py-2.5 text-xs font-bold text-[#111111] hover:bg-[#EEE] transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#333] transition cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

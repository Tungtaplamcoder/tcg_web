import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * ErrorBoundary — class-based React error boundary.
 *
 * Catches any render/lifecycle error inside its subtree so a single
 * broken page can never blank the whole app. Logs the full error,
 * component stack, and digest to the browser console for diagnosis,
 * then offers a self-contained recovery UI (retry / home) instead of
 * a white screen.
 *
 * Note: boundaries catch render errors, not event-handler or async
 * errors — those are handled by try/catch in the failing code.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null, attempt: 0 };
  }

  static getDerivedStateFromError(error) {
    // Next render shows the fallback UI
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // ── Detailed console diagnostics ────────────────────────────
    console.error('══════════════════════════════════════════════');
    console.error(`[ErrorBoundary] ${this.props.label || 'Component'} crashed:`, error);
    if (error?.message) console.error('[ErrorBoundary] message:', error.message);
    if (error?.stack) console.error('[ErrorBoundary] stack:', error.stack);
    if (errorInfo?.componentStack) {
      console.error('[ErrorBoundary] component stack:', errorInfo.componentStack);
    }
    console.error('══════════════════════════════════════════════');
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Remount the child subtree from scratch
    this.setState((s) => ({ error: null, errorInfo: null, attempt: s.attempt + 1 }));
  };

  render() {
    const { error } = this.state;
    if (error) {
      // Optional custom fallback
      if (this.props.fallback) {
        return this.props.fallback({ error, reset: this.handleReset });
      }
      return (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center app-bg">
          <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-400/15 ring-1 ring-rose-400/30 mb-5">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
          </div>
          <h1 className="heading-display text-2xl">Something went wrong</h1>
          <p className="text-muted text-sm mt-2 max-w-md mx-auto">
            This page hit an unexpected error while rendering. The rest of the
            store is still working — try again, or head back to the catalog.
          </p>
          {error?.message && (
            <p className="mt-4 rounded-xl glass-panel px-4 py-3 text-xs font-mono text-left text-rose-600 dark:text-rose-300 overflow-x-auto">
              {error.message}
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button type="button" onClick={this.handleReset} className="btn-primary !py-2.5">
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
            <Link to="/catalog" className="btn-secondary !py-2.5">
              <Home className="h-4 w-4" /> Back to catalog
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

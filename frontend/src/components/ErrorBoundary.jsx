import React from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    sessionStorage.removeItem("chunk_reload_attempted");
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
          <div className="card max-w-md space-y-4 p-6 shadow-xl border border-red-200 dark:border-red-900/50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Something went wrong</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                A page update or runtime script error occurred. Click below to reload the app with the latest code.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 text-xs text-slate-600 dark:text-slate-400 font-mono text-left overflow-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <button onClick={this.handleReload} className="btn-primary w-full justify-center">
              <RotateCcw size={16} /> Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

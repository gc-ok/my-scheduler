import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ color: "#c0392b", marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ color: "#555", marginBottom: 20, maxWidth: 500, margin: "0 auto 20px" }}>
            The schedule view encountered an error. This may be caused by corrupted data.
          </p>
          <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, fontSize: 12, textAlign: "left", maxWidth: 600, margin: "0 auto 20px", overflow: "auto" }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: "10px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

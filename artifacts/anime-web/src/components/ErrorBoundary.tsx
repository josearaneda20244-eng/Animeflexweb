import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AnimeFlex ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", background: "#000",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 24, gap: 16, fontFamily: "Inter, sans-serif",
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 800, margin: 0 }}>
            Algo salió mal
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0, textAlign: "center", maxWidth: 360 }}>
            {this.state.error?.message || "Error desconocido"}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "linear-gradient(135deg,#FF3355,#E11D48)",
              border: "none", borderRadius: 12, padding: "10px 22px",
              color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

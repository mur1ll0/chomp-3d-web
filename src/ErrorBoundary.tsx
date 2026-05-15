import React from 'react';
import { tStandalone } from './i18n/useT';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('React Error Boundary caught:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          padding: 40, fontFamily: 'monospace', background: '#0f172a', color: '#fbbf24',
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <h1 style={{ fontSize: 24, marginBottom: 16 }}>{tStandalone('error.title')}</h1>
          <pre style={{
            background: '#1e293b', padding: 20, borderRadius: 8, maxWidth: 600,
            whiteSpace: 'pre-wrap', color: '#ef4444', fontSize: 13
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{
              marginTop: 20, padding: '10px 24px', background: '#f59e0b', color: '#000',
              border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            {tStandalone('error.reload')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

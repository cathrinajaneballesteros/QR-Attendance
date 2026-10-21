import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught a component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 8px 30px rgba(107, 15, 58, 0.08)',
            border: '1px solid rgba(194, 24, 91, 0.15)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#FDF2F6',
              color: '#C2185B',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <AlertTriangle size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '24px', lineHeight: 1.5 }}>
              An unexpected error occurred while displaying this page. You can refresh or return to the main dashboard.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => window.location.reload()}
                className="sres-btn sres-btn-primary sres-btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={15} />
                Refresh Page
              </button>
              <a 
                href="/"
                className="sres-btn sres-btn-secondary sres-btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              >
                <Home size={15} />
                Return to Dashboard
              </a>
            </div>
            {this.state.error?.message && (
              <details style={{ marginTop: '20px', textAlign: 'left', fontSize: '0.75rem', color: '#9ca3af' }}>
                <summary style={{ cursor: 'pointer', outline: 'none' }}>Technical Details</summary>
                <pre style={{
                  marginTop: '8px',
                  padding: '10px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  color: '#dc2626'
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

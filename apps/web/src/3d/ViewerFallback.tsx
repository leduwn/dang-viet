/**
 * Viewer Fallback & Error Boundary Module
 * Handles WebGL context failure, shader compilation errors, or network asset load faults.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface WebGLBoundaryProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
  onReset?: () => void;
}

interface WebGLBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class WebGLBoundary extends React.Component<WebGLBoundaryProps, WebGLBoundaryState> {
  constructor(props: WebGLBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): WebGLBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.warn('[WebGLBoundary] 3D Renderer fault caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '320px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            textAlign: 'center',
            border: '1px dashed var(--border-light)',
          }}
        >
          <AlertTriangle size={36} color="var(--accent-red)" style={{ marginBottom: '0.75rem' }} />
          <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Không thể khởi tạo chế độ 3D
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '360px', marginBottom: '1.25rem' }}>
            Trình duyệt hoặc phần cứng đồ họa đang gặp gián đoạn WebGL. Bạn có thể thử lại hoặc sử dụng bản vẽ 2D.
          </p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={this.handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              padding: '0.45rem 1rem',
              borderRadius: '20px',
            }}
          >
            <RefreshCw size={14} />
            Thử tải lại 3D
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

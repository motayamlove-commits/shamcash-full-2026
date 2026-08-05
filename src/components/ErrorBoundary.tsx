import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
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
    // Only show error for critical errors, not Firebase SDK internal errors
    const isFirebaseError = error.message?.includes('channel') || 
                           error.message?.includes('firebase');
    
    if (isFirebaseError) {
      console.warn('[ErrorBoundary] Ignoring Firebase SDK error:', error.message);
      return { hasError: false, error: null };
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log Firebase errors as warnings, not errors
    const isFirebaseError = error.message?.includes('channel') || 
                           error.message?.includes('firebase');
    
    if (isFirebaseError) {
      console.warn('[ErrorBoundary] Firebase SDK error (ignored):', error.message);
      return;
    }
    
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">حدث خطأ</h2>
            <p className="text-slate-400 text-sm mb-4">
              {this.state.error?.message || 'حدث خطأ غير متوقع'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
